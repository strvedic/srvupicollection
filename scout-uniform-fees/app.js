(function () {
  "use strict";

  var FEE_AMOUNT = 0;
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
  var verifyBackBtn = document.getElementById("verify-back-btn");
  var verifyConfirmBtn = document.getElementById("verify-confirm-btn");

  var payAmount = document.getElementById("pay-amount");
  var payName = document.getElementById("pay-name");
  var payClass = document.getElementById("pay-class");
  var payUpi = document.getElementById("pay-upi");
  var qrBox = document.getElementById("qr-box");
  var copyBtn = document.getElementById("copy-btn");
  var copyIcon = document.getElementById("copy-icon");
  var copyLabel = document.getElementById("copy-label");
  var payBackBtn = document.getElementById("pay-back-btn");

  var students = null;
  var studentsPromise = null;
  var currentMatch = null;

  var eventPromise = fetch(EVENT_URL)
    .then(function (res) { return res.json(); })
    .then(function (ev) {
      FEE_AMOUNT = ev.amount;
      PAYEE_NAME = ev.event;
      NOTE_PREFIX = ev.slug;
      payAmount.textContent = "₹" + FEE_AMOUNT.toLocaleString("en-IN");
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
        currentMatch = { id: raw, name: record.n, cls: record.c, upi: record.u };
        vId.textContent = currentMatch.id;
        vName.textContent = currentMatch.name;
        vClass.textContent = currentMatch.cls;
        showStep("verify");
      })
      .catch(function () {
        setSearching(false);
        showError("Could not load student records right now. Please check your connection and try again.");
      });
  }

  function buildUpiLink(match) {
    var note = NOTE_PREFIX + "-" + match.id;
    var params = [
      "pa=" + encodeURIComponent(match.upi),
      "pn=" + encodeURIComponent(PAYEE_NAME),
      "am=" + encodeURIComponent(FEE_AMOUNT),
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

  function proceedToPayment() {
    if (!currentMatch) return;
    payName.textContent = currentMatch.name;
    payClass.textContent = currentMatch.cls;
    payUpi.textContent = currentMatch.upi;
    renderQr(buildUpiLink(currentMatch));
    copyIcon.textContent = "📋";
    copyLabel.textContent = "Copy";
    copyBtn.classList.remove("copied");
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

  loadStudents().catch(function () {});
})();
