(function () {
  "use strict";

  const config = window.APPLICATION_CONFIG || {};
  const button = document.getElementById("apply-now-button");
  const note = document.getElementById("landing-status-note");
  const manager = document.getElementById("landing-manager-name");

  function lockButton(message, isError) {
    button.classList.add("is-disabled");
    button.setAttribute("aria-disabled", "true");
    button.textContent = "التقديم مغلق حاليًا";
    note.textContent = message;
    note.classList.toggle("is-error", Boolean(isError));
  }

  function openButton(message) {
    button.classList.remove("is-disabled");
    button.removeAttribute("aria-disabled");
    button.textContent = "قدّم الآن";
    note.textContent = message;
    note.classList.remove("is-error");
  }

  async function refreshStatus() {
    const endpoint = config.statusEndpoint || config.endpoint;
    if (!endpoint) {
      lockButton("تعذر التحقق من حالة التقديم. حاول مرة أخرى لاحقًا.", true);
      return;
    }

    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await fetch(`${endpoint}${separator}action=status&t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        redirect: "follow"
      });
      if (!response.ok) throw new Error(`Status request failed with ${response.status}`);
      const payload = await response.json();
      if (typeof payload.isOpen !== "boolean") throw new Error("Invalid status response");

      manager.textContent = String(payload.managerName || config.managerName || "خيرو بن طيب").trim();
      if (payload.isOpen) {
        openButton("التقديم مفتوح الآن. تأكد من الشروط ثم ابدأ تعبئة طلبك.");
      } else {
        lockButton(String(payload.closedMessage || config.closedMessage || "التقديم مغلق الآن. راجع إعلانات الديسكورد."));
      }
    } catch (error) {
      console.warn("Application status check failed; access remains closed.", error);
      lockButton("تعذر التحقق من حالة التقديم، لذلك بقي الدخول مغلقًا احترازيًا.", true);
    }
  }

  button.addEventListener("click", (event) => {
    if (button.getAttribute("aria-disabled") === "true") event.preventDefault();
  });
  window.addEventListener("focus", refreshStatus);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
  refreshStatus();
})();
