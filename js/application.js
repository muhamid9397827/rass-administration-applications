(function () {
  "use strict";

  const config = window.APPLICATION_CONFIG || {};
  const RECEIPT_KEY = "rass-administration-application:receipt";
  const STATUS_REFRESH_INTERVAL_MS = 15000;
  const elements = {};
  let isSubmitting = false;
  let statusRequest = null;
  let state = { isOpen: false, isVerified: false, status: "checking", managerName: config.managerName, closedMessage: config.closedMessage };

  function boot() {
    injectCompactSubmitStyles();
    ["application-manager-name", "application-status-card", "application-status-title", "application-status-note", "application-closed-panel", "application-closed-title", "application-closed-message", "administration-application-form", "application-age", "application-discord-id", "application-form-status", "application-submit-button", "application-success-panel", "application-receipt"].forEach((id) => {
      elements[toCamelCase(id)] = document.getElementById(id);
    });
    applyStatus();
    elements.administrationApplicationForm.addEventListener("submit", handleSubmit);
    elements.applicationAge.addEventListener("input", () => elements.applicationAge.setCustomValidity(""));
    elements.applicationDiscordId.addEventListener("input", () => elements.applicationDiscordId.setCustomValidity(""));
    window.addEventListener("focus", refreshStatus);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
    restoreReceipt();
    refreshStatus();
    window.setInterval(refreshStatus, STATUS_REFRESH_INTERVAL_MS);
  }

  function injectCompactSubmitStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .submit-section{padding:20px 24px;border-radius:16px}
      .declaration{margin-bottom:14px;gap:9px;font-size:.86rem;line-height:1.55}
      .declaration input{flex-basis:18px;width:18px;min-height:18px;margin-top:2px}
      .primary-button{min-width:min(100%,300px);min-height:48px;padding:0 22px;border-radius:12px;font-size:.94rem}
      .site-footer{padding-top:20px;padding-bottom:26px;margin-top:28px}
      @media(max-width:820px){
        .submit-section{padding:16px 14px}
        .declaration{font-size:.8rem;text-align:start}
        .primary-button{min-height:46px;width:100%}
        .site-footer{margin-top:20px}
      }
    `;
    document.head.appendChild(style);
  }

  function toCamelCase(value) { return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }

  function applyStatus() {
    const canApply = state.isVerified && state.isOpen;
    const isChecking = !state.isVerified && state.status !== "error";
    elements.applicationManagerName.textContent = state.managerName || "خيرو بن طيب";
    elements.applicationStatusCard.classList.toggle("is-checking", isChecking);
    elements.applicationStatusCard.classList.toggle("is-open", canApply);
    elements.applicationStatusCard.classList.toggle("is-closed", !canApply && !isChecking);
    elements.applicationStatusCard.setAttribute("aria-busy", String(isChecking));

    if (isChecking) {
      elements.applicationStatusTitle.textContent = "جاري التحقق...";
      elements.applicationStatusNote.textContent = "يرجى الانتظار حتى يتم التحقق من حالة التقديم.";
    } else if (canApply) {
      elements.applicationStatusTitle.textContent = "التقديم مفتوح الآن";
      elements.applicationStatusNote.textContent = "يمكنك تعبئة النموذج وإرسال طلبك إلى الإدارة.";
    } else if (state.status === "error") {
      elements.applicationStatusTitle.textContent = "تعذر التحقق من الحالة";
      elements.applicationStatusNote.textContent = "البوابة مغلقة احترازيًا. أعد تحميل الصفحة بعد قليل.";
    } else {
      elements.applicationStatusTitle.textContent = "التقديم مغلق حاليًا";
      elements.applicationStatusNote.textContent = state.closedMessage;
    }

    elements.applicationClosedTitle.textContent = state.status === "error" ? "التقديم غير متاح حاليًا" : "التقديم مغلق حاليًا";
    elements.applicationClosedMessage.textContent = state.status === "error" ? "تعذر الاتصال بخدمة التقديم. حاول لاحقًا." : state.closedMessage;
    elements.applicationClosedPanel.hidden = canApply || isChecking;
    if (elements.applicationSuccessPanel.hidden) elements.administrationApplicationForm.hidden = !canApply;
    elements.applicationSubmitButton.disabled = !canApply || isSubmitting;
  }

  async function refreshStatus(options = {}) {
    const failClosed = options && options.failClosed === true;
    if (statusRequest) {
      if (failClosed) { state = { ...state, isOpen: false, isVerified: false, status: "checking" }; applyStatus(); }
      return statusRequest;
    }
    const endpoint = config.statusEndpoint || config.endpoint;
    if (!endpoint) { state = { ...state, isOpen: false, isVerified: false, status: "error" }; applyStatus(); return false; }
    if (failClosed || !state.isVerified) { state = { ...state, isOpen: false, isVerified: false, status: "checking" }; applyStatus(); }

    statusRequest = (async () => {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await fetch(`${endpoint}${separator}action=status&t=${Date.now()}`, { method: "GET", cache: "no-store", redirect: "follow" });
      if (!response.ok) throw new Error(`Status request failed with ${response.status}`);
      const payload = await response.json();
      if (typeof payload.isOpen !== "boolean") throw new Error("Invalid status response");
      state = { isOpen: payload.isOpen, isVerified: true, status: payload.isOpen ? "open" : "closed", managerName: clean(payload.managerName) || config.managerName, closedMessage: clean(payload.closedMessage) || config.closedMessage };
      applyStatus();
      return true;
    })().catch((error) => {
      console.warn("Application status check failed; access remains closed.", error);
      state = { ...state, isOpen: false, isVerified: false, status: "error" };
      applyStatus();
      return false;
    }).finally(() => { statusRequest = null; });
    return statusRequest;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    clearFormStatus();
    const confirmed = await refreshStatus({ failClosed: true });
    if (!confirmed || !state.isVerified || !state.isOpen) { showFormStatus("التقديم مغلق أو تعذر التحقق من حالته. لم يتم إرسال الطلب.", true); return; }
    const form = elements.administrationApplicationForm;
    if (!validate(form)) return;

    const requestId = createRequestId();
    const payload = buildPayload(form, requestId);
    isSubmitting = true;
    elements.applicationSubmitButton.disabled = true;
    elements.applicationSubmitButton.textContent = "جاري إرسال الطلب...";
    try {
      await fetch(config.endpoint, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      sessionSet(RECEIPT_KEY, requestId);
      showSuccess(requestId);
    } catch (error) {
      console.error("Application submission failed:", error);
      showFormStatus("تعذر إرسال الطلب. تحقق من اتصالك ثم أعد المحاولة.", true);
      elements.applicationSubmitButton.disabled = false;
      elements.applicationSubmitButton.textContent = "إرسال طلب التقديم";
    } finally { isSubmitting = false; }
  }

  function validate(form) {
    if (!form.reportValidity()) { showFormStatus("أكمل جميع الحقول المطلوبة قبل الإرسال.", true); return false; }
    const age = Number(elements.applicationAge.value);
    if (!Number.isInteger(age) || age <= 20 || age > 100) { elements.applicationAge.setCustomValidity("يشترط أن يكون العمر أكثر من 20 عامًا."); elements.applicationAge.reportValidity(); showFormStatus("لا يستوفي العمر شرط القبول الأساسي.", true); return false; }
    const discordId = westernDigits(elements.applicationDiscordId.value).trim();
    if (!/^\d{15,20}$/.test(discordId)) { elements.applicationDiscordId.setCustomValidity("أدخل معرف Discord الرقمي الصحيح."); elements.applicationDiscordId.reportValidity(); showFormStatus("تحقق من معرف Discord.", true); return false; }
    elements.applicationDiscordId.value = discordId;
    if (!form.elements.confidentialityPledge.value.startsWith("نعم")) { showFormStatus("لا يمكن إرسال الطلب دون التعهد بالمحافظة على سرية المعلومات.", true); form.elements.confidentialityPledge.focus(); return false; }
    return true;
  }

  function buildPayload(form, requestId) {
    const data = new FormData(form);
    return { applicationType: "ras_administration", requestId, fullName: clean(data.get("fullName")), discordId: westernDigits(clean(data.get("discordId"))), serverName: clean(data.get("serverName")), age: Number(data.get("age")), confidentialityPledge: clean(data.get("confidentialityPledge")), experience: clean(data.get("experience")), dailyHours: clean(data.get("dailyHours")), joinReason: clean(data.get("joinReason")), angryPersonResponse: clean(data.get("angryPersonResponse")), secretInfoResponse: clean(data.get("secretInfoResponse")), unknownProblemResponse: clean(data.get("unknownProblemResponse")), previousPunishments: clean(data.get("previousPunishments")), teamworkCommitment: clean(data.get("teamworkCommitment")), pressureResponse: clean(data.get("pressureResponse")), rulesAgreement: clean(data.get("rulesAgreement")), noBansDeclaration: clean(data.get("noBansDeclaration")) };
  }

  function createRequestId() { const part = crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10); return `RAS-${Date.now().toString(36).toUpperCase()}-${part.toUpperCase()}`; }
  function showSuccess(id) { elements.applicationReceipt.textContent = id; elements.administrationApplicationForm.hidden = true; elements.applicationClosedPanel.hidden = true; elements.applicationSuccessPanel.hidden = false; window.scrollTo({ top: 0, behavior: "smooth" }); }
  function restoreReceipt() { const id = sessionGet(RECEIPT_KEY); if (id) showSuccess(id); }
  function showFormStatus(message, error) { elements.applicationFormStatus.hidden = false; elements.applicationFormStatus.textContent = message; elements.applicationFormStatus.classList.toggle("is-error", Boolean(error)); }
  function clearFormStatus() { elements.applicationFormStatus.hidden = true; elements.applicationFormStatus.textContent = ""; elements.applicationFormStatus.classList.remove("is-error"); }
  function westernDigits(value) { const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" }; return String(value).replace(/[٠-٩۰-۹]/g, (digit) => map[digit] || digit); }
  function clean(value) { return value == null ? "" : String(value).trim(); }
  function sessionGet(key) { try { return sessionStorage.getItem(key) || ""; } catch { return ""; } }
  function sessionSet(key, value) { try { sessionStorage.setItem(key, String(value)); } catch { /* Storage is optional. */ } }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
})();
