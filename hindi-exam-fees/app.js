(function () {
  "use strict";

  var FEE_AMOUNT = 0;
  var OPTIONS = [];   // fee choices (e.g. one per exam); the parent picks one when the student has no fixed amount
  var PAYEE_NAME = "";
  var NOTE_PREFIX = "";
  var DATA_URL = "students.json";
  var EVENT_URL = "event.json";

  var studentIdInput = document.getElementById("student-id");
  var searchBtn = document.getElementById("search-btn");
  var searchError = document.getElementById("search-error");
  var searchErrorText = document.getElementById("search-error-text");

  var stepSearch = document.getElementById("step-search");
  var stepVerify = document.getElementById("step-verify");
  var stepPay = document.getElementById("step-pay");

  var vId = document.getElementById("v-id");
  var vName = document.getElementById("v-name");
  var vClass = document.getElementById("v-class");
  var vAmount = document.getElementById("v-amount");
  var verifyBackBtn = document.getElementById("verify-back-btn");
  var verifyConfirmBtn = document.getElementById("verify-confirm-btn");

  var payAmount = document.getElementById("pay-amount");
  var payBreakdown = document.getElementById("pay-breakdown");
  var payName = document.getElementById("pay-name");
  var payClass = document.getElementById("pay-class");
  var payUpi = document.getElementById("pay-upi");
  var qrBox = document.getElementById("qr-box");
  var copyBtn = document.getElementById("copy-btn");
  var copyIcon = document.getElementById("copy-icon");
  var copyLabel = document.getElementById("copy-label");
  var payBackBtn = document.getElementById("pay-back-btn");
  var payMain = document.getElementById("pay-main");
  var optBox = document.getElementById("opt-box");
  var optName = document.getElementById("opt-name");
  var optList = document.getElementById("opt-list");
  var optChange = document.getElementById("opt-change");

  var students = null;
  var studentsPromise = null;
  var currentMatch = null;

  var eventPromise = fetch(EVENT_URL)
    .then(function (res) { return res.json(); })
    .then(function (ev) {
      FEE_AMOUNT = ev.amount;
      OPTIONS = ev.options || [];
      PAYEE_NAME = ev.event;
      NOTE_PREFIX = ev.slug;
    });

  function loadStudents() {
    if (studentsPromise) return studentsPromise;
    studentsPromise = eventPromise
      .then(function () { return fetch(DATA_URL); })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to load student data");
        return res.json();
      })
      .then(function (json) {
        students = json;
        return students;
      });
    return studentsPromise;
  }

  function rupees(v) {
    return "₹" + Number(v).toLocaleString("en-IN");
  }

  function showStep(step) {
    stepSearch.hidden = step !== "search";
    stepVerify.hidden = step !== "verify";
    stepPay.hidden = step !== "pay";
  }

  function showError(msg) {
    searchErrorText.textContent = msg;
    searchError.hidden = false;
  }

  function clearError() {
    searchError.hidden = true;
  }

  function setSearching(isSearching) {
    searchBtn.disabled = isSearching;
    searchBtn.textContent = isSearching ? "Searching..." : "Search";
  }

  function doSearch() {
    var raw = studentIdInput.value.trim().toUpperCase();
    studentIdInput.value = raw;
    clearError();

    if (!raw) {
      showError("Please enter a Student ID.");
      return;
    }

    setSearching(true);
    loadStudents()
      .then(function (data) {
        setSearching(false);
        var record = data[raw];
        if (!record) {
          showError("No student found with ID \"" + raw + "\". Please check the ID and try again, or contact the school office.");
          return;
        }
        // each student carries their own amount (a); older pages fall back to the event amount
        // a student without a fixed amount in an event with fee choices picks one on the next step
        var chooses = !record.a && OPTIONS.length > 0;
        currentMatch = { id: raw, name: record.n, cls: record.c, upi: record.u, chooses: chooses, choice: "",
                         amount: chooses ? 0 : (record.a || FEE_AMOUNT), fee: record.f, late: record.l };
        vId.textContent = currentMatch.id;
        vName.textContent = currentMatch.name;
        vClass.textContent = currentMatch.cls;
        vAmount.textContent = chooses ? "Choose on the next step" : rupees(currentMatch.amount);
        showStep("verify");
      })
      .catch(function () {
        setSearching(false);
        showError("Could not load student records right now. Please check your connection and try again.");
      });
  }

  function buildUpiLink(match) {
    var note = NOTE_PREFIX + "-" + match.id + (match.choice ? "-" + match.choice : "");
    var params = [
      "pa=" + encodeURIComponent(match.upi),
      "pn=" + encodeURIComponent(PAYEE_NAME),
      "am=" + encodeURIComponent(match.amount),
      "cu=INR",
      "tn=" + encodeURIComponent(note)
    ];
    return "upi://pay?" + params.join("&");
  }

  function renderQr(text) {
    qrBox.innerHTML = "";
    var qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    qrBox.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }

  function showChoices() {
    optName.textContent = currentMatch.name + " (" + currentMatch.cls + ")";
    optList.innerHTML = "";
    OPTIONS.forEach(function (o) {
      var b = document.createElement("button");
      b.className = "opt-btn";
      var n = document.createElement("span");
      n.textContent = o.name;
      var f = document.createElement("span");
      f.className = "opt-fee";
      f.textContent = rupees(o.amount);
      b.appendChild(n);
      b.appendChild(f);
      b.addEventListener("click", function () {
        currentMatch.choice = o.name;
        currentMatch.amount = o.amount;
        showPayment();
      });
      optList.appendChild(b);
    });
    optBox.hidden = false;
    payMain.hidden = true;
  }

  function showPayment() {
    optBox.hidden = true;
    payMain.hidden = false;
    payName.textContent = currentMatch.name;
    payClass.textContent = currentMatch.cls;
    payAmount.textContent = rupees(currentMatch.amount);
    payBreakdown.hidden = !(currentMatch.late || currentMatch.choice);
    payBreakdown.textContent = currentMatch.choice ? currentMatch.choice
      : currentMatch.late ? "Fee " + rupees(currentMatch.fee) + " + Late fee " + rupees(currentMatch.late) : "";
    optChange.hidden = !currentMatch.chooses;
    payUpi.textContent = currentMatch.upi;
    renderQr(buildUpiLink(currentMatch));
    copyIcon.textContent = "📋";
    copyLabel.textContent = "Copy";
    copyBtn.classList.remove("copied");
  }

  function proceedToPayment() {
    if (!currentMatch) return;
    if (currentMatch.chooses) showChoices();
    else showPayment();
    showStep("pay");
  }

  function copyUpi() {
    if (!currentMatch) return;
    var text = currentMatch.upi;
    var markCopied = function () {
      copyIcon.textContent = "✓";
      copyLabel.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(function () {
        copyIcon.textContent = "📋";
        copyLabel.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 1800);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(markCopied).catch(function () {
        fallbackCopy(text, markCopied);
      });
    } else {
      fallbackCopy(text, markCopied);
    }
  }

  function fallbackCopy(text, cb) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
    cb();
  }

  function resetToSearch() {
    currentMatch = null;
    clearError();
    studentIdInput.value = "";
    showStep("search");
    studentIdInput.focus();
  }

  searchBtn.addEventListener("click", doSearch);
  studentIdInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSearch();
  });
  studentIdInput.addEventListener("input", clearError);

  verifyConfirmBtn.addEventListener("click", proceedToPayment);
  verifyBackBtn.addEventListener("click", resetToSearch);
  payBackBtn.addEventListener("click", resetToSearch);
  copyBtn.addEventListener("click", copyUpi);
  optChange.addEventListener("click", showChoices);

  loadStudents().catch(function () {});
})();
