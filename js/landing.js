(function () {
  "use strict";

  const config = window.APPLICATION_CONFIG || {};
  const button = document.getElementById("apply-now-button");
  const note = document.getElementById("landing-status-note");
  const manager = document.getElementById("landing-manager-name");

  function applyHeroDesign() {
    const heading = document.querySelector(".hero-copy h1");
    if (heading) heading.innerHTML = "التقديم على <span>الإدارة</span>";
    document.title = "التقديم على الإدارة | محافظة الرس";

    const style = document.createElement("style");
    style.textContent = `
      .home-hero{
        grid-template-columns:minmax(0,1fr) 290px;
        gap:38px;
        padding:34px 42px;
        align-items:center;
      }
      .hero-copy{
        max-width:780px;
      }
      .hero-copy .eyebrow{
        margin-bottom:4px;
      }
      .hero-copy h1{
        max-width:680px;
        margin:10px 0 12px;
        font-size:clamp(2.35rem,4.7vw,4rem);
        line-height:1.12;
        letter-spacing:-.045em;
      }
      .hero-copy h1 span{
        display:block;
        margin-top:3px;
      }
      .hero-copy>p{
        max-width:650px;
        line-height:1.8;
      }
      .hero-actions{
        margin-top:22px;
        gap:11px;
      }
      .hero-actions a{
        min-width:185px;
        min-height:48px;
      }
      .status-note{
        margin-top:10px;
      }
      .home-status{
        width:100%;
        max-width:290px;
        justify-self:start;
        padding:22px;
        border-radius:16px;
      }
      .home-status .status-symbol{
        width:42px;
        height:42px;
        margin-bottom:11px;
      }
      .home-status strong{
        font-size:1rem;
      }
      @media(max-width:850px){
        .home-hero{
          grid-template-columns:1fr;
          gap:18px;
          padding:24px;
        }
        .home-status{
          max-width:none;
          justify-self:stretch;
        }
      }
      @media(max-width:520px){
        .home-hero{padding:19px 14px}
        .hero-copy h1{font-size:2.15rem}
        .hero-actions a{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

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
    button.textContent = "ابدأ التقديم";
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

  applyHeroDesign();
  button.addEventListener("click", (event) => {
    if (button.getAttribute("aria-disabled") === "true") event.preventDefault();
  });
  window.addEventListener("focus", refreshStatus);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshStatus(); });
  refreshStatus();
})();
