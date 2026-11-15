(() => {
  "use strict";

  const wait = setInterval(() => {
    const required = [
      "hero",
      "scene",
      "checkpoint",
      "last",
      "instruction",
      "progress",
      "temperature",
      "confirm",
      "map"
    ];

    const ready = required.every(id =>
      document.getElementById(id)
    );

    if (!ready || !document.querySelector("#checkpoint option")) {
      return;
    }

    clearInterval(wait);
    setup();
  }, 200);

  function setup() {
    const $ = id => document.getElementById(id);
    const hero = $("hero");
    const scene = $("scene");

    if (hero.dataset.toonReady === "true") {
      return;
    }

    hero.dataset.toonReady = "true";

    /*
     * Original vintage-cartoon ghost.
     * The CSS animates the named body, arm, and leg groups.
     */

    hero.innerHTML = `
      <svg
        class="toon-ghost"
        viewBox="0 0 180 235"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <!-- Ground shadow -->

        <ellipse
          class="toon-shadow"
          cx="91"
          cy="225"
          rx="48"
          ry="7"
          fill="#29232a"
        />

        <!-- Left rubber-hose leg -->

        <g class="toon-leg-left">
          <path
            d="M72 148
               C69 165 57 176 61 195"
            fill="none"
            stroke="#29232a"
            stroke-width="11"
            stroke-linecap="round"
          />

          <path
            d="M53 190
               L70 190
               L71 202
               L53 203 Z"
            fill="#fff8e7"
            stroke="#29232a"
            stroke-width="4"
            stroke-linejoin="round"
          />

          <path
            d="M54 198
               C43 193 28 198 25 208
               C22 218 34 222 48 221
               L74 219
               C78 214 75 204 69 199 Z"
            fill="#bd493b"
            stroke="#29232a"
            stroke-width="5"
            stroke-linejoin="round"
          />

          <path
            d="M28 214 Q48 220 74 214"
            fill="none"
            stroke="#29232a"
            stroke-width="4"
            stroke-linecap="round"
          />

          <path
            d="M37 204 Q43 201 49 202"
            fill="none"
            stroke="#ed9b78"
            stroke-width="3"
            stroke-linecap="round"
          />
        </g>

        <!-- Right rubber-hose leg -->

        <g class="toon-leg-right">
          <path
            d="M108 148
               C110 166 123 177 119 195"
            fill="none"
            stroke="#29232a"
            stroke-width="11"
            stroke-linecap="round"
          />

          <path
            d="M111 190
               L128 190
               L128 203
               L110 202 Z"
            fill="#fff8e7"
            stroke="#29232a"
            stroke-width="4"
            stroke-linejoin="round"
          />

          <path
            d="M112 199
               C121 194 137 195 148 205
               C158 216 147 222 132 221
               L107 219
               C103 213 105 204 112 199 Z"
            fill="#bd493b"
            stroke="#29232a"
            stroke-width="5"
            stroke-linejoin="round"
          />

          <path
            d="M108 214 Q133 220 151 214"
            fill="none"
            stroke="#29232a"
            stroke-width="4"
            stroke-linecap="round"
          />

          <path
            d="M128 202 Q136 201 141 206"
            fill="none"
            stroke="#ed9b78"
            stroke-width="3"
            stroke-linecap="round"
          />
        </g>

        <!-- Floating body and arms -->

        <g class="toon-body">

          <!-- Left arm and glove -->

          <g class="toon-arm-left">
            <path
              d="M49 91
                 C28 89 21 108 26 125"
              fill="none"
              stroke="#29232a"
              stroke-width="10"
              stroke-linecap="round"
            />

            <path
              d="M20 118
                 L32 117
                 L36 129
                 L22 134 Z"
              fill="#fff8e7"
              stroke="#29232a"
              stroke-width="4"
              stroke-linejoin="round"
            />

            <path
              d="M23 128
                 C12 126 10 136 15 143
                 C11 151 18 158 24 155
                 C28 162 37 158 38 153
                 C46 153 48 145 43 139
                 L35 130
                 Q30 126 23 128 Z"
              fill="#fff8e7"
              stroke="#29232a"
              stroke-width="4"
              stroke-linejoin="round"
            />

            <path
              d="M23 140 L25 149
                 M31 138 L34 148"
              fill="none"
              stroke="#29232a"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </g>

          <!-- Right arm and glove -->

          <g class="toon-arm-right">
            <path
              d="M131 91
                 C151 87 160 105 154 123"
              fill="none"
              stroke="#29232a"
              stroke-width="10"
              stroke-linecap="round"
            />

            <path
              d="M148 117
                 L161 119
                 L158 133
                 L144 129 Z"
              fill="#fff8e7"
              stroke="#29232a"
              stroke-width="4"
              stroke-linejoin="round"
            />

            <path
              d="M147 129
                 C156 124 166 130 166 139
                 C173 145 168 154 161 153
                 C158 161 149 160 145 154
                 C136 154 133 146 139 139 Z"
              fill="#fff8e7"
              stroke="#29232a"
              stroke-width="4"
              stroke-linejoin="round"
            />

            <path
              d="M151 139 L148 149
                 M159 141 L156 150"
              fill="none"
              stroke="#29232a"
              stroke-width="2.5"
              stroke-linecap="round"
            />
          </g>

          <!-- Main ghost silhouette -->

          <path
            d="M43 77
               C38 46 50 23 75 18
               C105 10 132 27 137 57
               C141 78 132 94 132 111
               C132 130 141 140 146 146
               C133 150 122 146 116 139
               C114 153 101 163 90 153
               C80 166 63 158 61 146
               C49 155 35 150 31 145
               C46 136 48 124 44 109
               C41 98 42 88 43 77 Z"
            fill="#fff8e7"
            stroke="#29232a"
            stroke-width="5.5"
            stroke-linejoin="round"
          />

          <!-- Soft body shading -->

          <path
            d="M123 47
               C139 78 120 95 123 119
               Q125 136 134 142
               Q123 141 117 133
               Q113 151 104 151
               C115 132 110 115 116 95
               Q126 67 123 47 Z"
            fill="#dfd3b6"
            opacity=".65"
          />

          <!-- Forehead highlight -->

          <path
            d="M56 48 Q65 30 82 29"
            fill="none"
            stroke="#ffffff"
            stroke-width="5"
            stroke-linecap="round"
            opacity=".7"
          />

          <!-- Expressive eyebrows -->

          <path
            d="M57 53 Q66 43 77 49
               M94 47 Q108 41 117 51"
            fill="none"
            stroke="#29232a"
            stroke-width="5"
            stroke-linecap="round"
          />

          <!-- Large pie-cut eyes -->

          <ellipse
            cx="70"
            cy="73"
            rx="13"
            ry="22"
            fill="#29232a"
            transform="rotate(-8 70 73)"
          />

          <ellipse
            cx="104"
            cy="71"
            rx="13"
            ry="22"
            fill="#29232a"
            transform="rotate(5 104 71)"
          />

          <path
            d="M58 55 L71 70 L60 73 Z
               M93 53 L105 68 L94 71 Z"
            fill="#fff8e7"
          />

          <!-- Button nose -->

          <ellipse
            cx="87"
            cy="91"
            rx="10"
            ry="7"
            fill="#29232a"
          />

          <ellipse
            cx="84"
            cy="88.5"
            rx="3"
            ry="1.5"
            fill="#fff8e7"
            opacity=".8"
          />

          <!-- Mischievous grin -->

          <path
            d="M59 103
               Q87 121 118 99
               C111 128 96 137 80 130
               Q66 125 59 103 Z"
            fill="#29232a"
            stroke="#29232a"
            stroke-width="3"
            stroke-linejoin="round"
          />

          <!-- Upper teeth -->

          <path
            d="M65 107
               Q88 119 111 105
               L106 114
               Q86 125 70 115 Z"
            fill="#fff8e7"
          />

          <path
            d="M83 114 L83 119
               M96 113 L96 119"
            stroke="#29232a"
            stroke-width="2"
          />

          <!-- Tongue -->

          <path
            d="M83 128 Q93 116 105 123
               Q95 134 83 128 Z"
            fill="#cb6b60"
          />

          <!-- Cheek creases -->

          <path
            d="M53 101 Q56 96 62 98
               M115 96 Q121 93 125 98"
            fill="none"
            stroke="#29232a"
            stroke-width="3"
            stroke-linecap="round"
          />

          <path
            d="M51 107 L47 111
               M122 104 L127 107"
            fill="none"
            stroke="#c47b66"
            stroke-width="3"
            stroke-linecap="round"
          />
        </g>
      </svg>
    `;

    scene.setAttribute(
      "aria-label",
      "Journey progress"
    );

    let readout = $("motion-status");

    if (!readout) {
      readout = document.createElement("p");
      readout.id = "motion-status";
      readout.setAttribute("aria-live", "polite");
      scene.after(readout);
    }
    readout.hidden = true;

    let visits = 0;
    let lastSignature = "";
    let displayed = 0;
    let frame = null;
    let celebrationTimer = null;

    function reducedMotion() {
      return window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
    }

    /*
     * Keep the entire character inside the scene.
     * Progress is normalized against the progress element's max.
     */

    function progressPosition() {
      const progress = $("progress");
      const max = Number(progress.max) || 1;
      const value = Number(progress.value) || 0;
      const ratio = Math.max(0, Math.min(1, value / max));

      const available = Math.max(
        0,
        scene.clientWidth - hero.offsetWidth - 16
      );

      const start = Math.min(12, available);
      return start + ratio * (available - start);
    }

    function moveGhost(target, instant = false) {
      cancelAnimationFrame(frame);
      scene.classList.remove("moving");

      if (
        instant ||
        reducedMotion() ||
        Math.abs(target - displayed) < 1
      ) {
        displayed = target;
        hero.style.left = `${target}px`;
        return;
      }

      const from = displayed;
      const started = performance.now();
      const duration = 1400;

      scene.classList.add("moving");

      function animate(now) {
        const t = Math.min(1, (now - started) / duration);
        const ease = t * t * (3 - 2 * t);

        displayed = from + (target - from) * ease;
        hero.style.left = `${displayed}px`;

        if (t < 1) {
          frame = requestAnimationFrame(animate);
        } else {
          scene.classList.remove("moving");
        }
      }

      frame = requestAnimationFrame(animate);
    }

    function celebrate() {
      clearTimeout(celebrationTimer);
      scene.classList.remove("celebrating");

      if (reducedMotion()) {
        return;
      }

      void hero.offsetWidth;
      scene.classList.add("celebrating");

      celebrationTimer = setTimeout(() => {
        scene.classList.remove("celebrating");
      }, 1800);
    }

    function update() {
      const signature = $("last").textContent.trim();

      if (signature === lastSignature) {
        return;
      }

      lastSignature = signature;

      const temperature = $("temperature").textContent;
      const noCheckpoint = /no checkpoint/i.test(signature);
      const sameCheckpoint = /same checkpoint/i.test(temperature);

      if (noCheckpoint) {
        visits = 0;

        clearTimeout(celebrationTimer);
        scene.classList.remove("celebrating");

        readout.textContent =
          "Start a journey to record checkpoint progress.";

        moveGhost(progressPosition(), true);
        return;
      }

      if (sameCheckpoint) {
        readout.textContent =
          "Same checkpoint confirmed again. " +
          "No new movement recorded.";

        return;
      }

      visits += 1;

      readout.textContent =
        `Checkpoint update ${visits} recorded. ` +
        "The ghost shows reported route progress, " +
        "not live physical movement.";

      moveGhost(progressPosition());

      if (scene.dataset.mood === "arrived") {
        celebrate();
      }
    }

    /*
     * Wait until the current app update finishes before reading
     * the checkpoint text and progress bar together.
     */

    let updateQueued = false;

    function queueUpdate() {
      if (updateQueued) {
        return;
      }

      updateQueued = true;

      queueMicrotask(() => {
        updateQueued = false;
        update();
      });
    }

    new MutationObserver(queueUpdate).observe($("last"), {
      childList: true,
      subtree: true,
      characterData: true
    });

    displayed = progressPosition();
    hero.style.left = `${displayed}px`;
    update();

    let resizeTimer;

    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(() => {
        moveGhost(progressPosition(), true);
      }, 100);
    });

    /*
     * QR scanner.
     * Successful scans use the existing confirmation button,
     * so the main app remains responsible for route updates.
     */

    if ($("scan-now")) {
      return;
    }

    const section = document.createElement("section");

    section.innerHTML = `
      <h2>Scan a checkpoint</h2>

      <p>
        Your location updates when you scan a code or confirm a checkpoint.
      </p>

      <div class="checkpoint-actions"><button id="scan-now" type="button">
        Scan QR code
      </button>
      <button id="checkpoint-code-toggle" type="button" aria-expanded="false" aria-controls="checkpoint-code-form">Enter checkpoint code</button>

      <button id="scan-stop" type="button" hidden>
        Stop camera
      </button></div>

      <form id="checkpoint-code-form" class="checkpoint-entry" hidden novalidate>
        <label for="checkpoint-code">Checkpoint code</label>
        <div class="checkpoint-entry-controls"><input id="checkpoint-code" type="text" placeholder="e.g. Q4" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="32" aria-describedby="checkpoint-code-feedback"><button id="checkpoint-code-confirm" type="submit">Confirm location</button></div>
        <p id="checkpoint-code-feedback" role="status" aria-live="polite"></p>
      </form>

      <p id="scan-note" role="status">
        Scan a code or enter its checkpoint code.
      </p>

      <div id="reader"></div>
    `;

    $("map").closest("section").before(section);

    const note = $("scan-note");
    const scanButton = $("scan-now");
    const stopButton = $("scan-stop");
    scanButton.disabled=document.documentElement.dataset.questPaused==='true';
    document.dispatchEvent(new CustomEvent('campus-checkpoint-entry-ready'));

    let scanner = null;
    let running = false;
    let starting = false;
    let busy = false;
    let libraryPromise = null;
    let navigationPauseVersion = 0;

    async function loadScannerLibrary() {
      if (window.Html5Qrcode) {
        return;
      }

      if (!libraryPromise) {
        libraryPromise = new Promise((resolve, reject) => {
          const script = document.createElement("script");

          script.src =
            "https://unpkg.com/html5-qrcode@2.3.8/" +
            "html5-qrcode.min.js";

          script.onload = () => {
            if (window.Html5Qrcode) {
              resolve();
            } else {
              reject(new Error("Scanner did not initialize."));
            }
          };

          script.onerror = () => {
            script.remove();
            reject(new Error("Scanner download failed."));
          };

          document.head.append(script);
        }).catch(error => {
          libraryPromise = null;
          throw error;
        });
      }

      await libraryPromise;
    }

    async function halt() {
      try {
        if (scanner && running) {
          await scanner.stop();
        }
      } catch {
        // The camera may already have stopped.
      } finally {
        running = false;

        try {
          scanner?.clear();
        } catch {
          // A partially initialized reader may not need clearing.
        }

        scanner = null;
        stopButton.hidden = true;
        scanButton.disabled = document.documentElement.dataset.questPaused === "true";
      }
    }

    function checkpointFromText(text) {
  const scannedText = String(text ?? "").trim();

  if (!scannedText) {
    throw new Error("The QR code contains no text.");
  }

  let url;

  try {
    url = new URL(scannedText, window.location.href);
  } catch {
    throw new Error("Invalid Campus Ghost QR code.");
  }

  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname
  ) {
    throw new Error(
      "Use a checkpoint QR code from this site."
    );
  }

  const id = (
    url.searchParams.get("checkpoint") ||
    url.searchParams.get("qr") ||
    ""
  ).trim().toUpperCase();

  const select = document.getElementById("checkpoint");

  const exists = [...select.options].some(
    option => option.value === id
  );

  if (!exists) {
    throw new Error("Unknown checkpoint.");
  }

  return id;
}

    async function onScan(text) {
      if (busy || (!running && !starting) || document.documentElement.dataset.questPaused === "true") {
        return;
      }

      let id;

      try {
        id = checkpointFromText(text);
      } catch (error) {
        note.textContent = error.message;
        return;
      }

      busy = true;

      try {
        const select = $("checkpoint");

        select.value = id;
        select.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        if ($("confirm").disabled) {
          throw new Error(
            "The confirmation button is unavailable. " +
            "Choose your course and destination first."
          );
        }

        $('confirm').dataset.confirmationMethod='qr';
        try { $('confirm').click(); } finally { delete $('confirm').dataset.confirmationMethod; }

        await halt();

        note.textContent = "Checkpoint confirmed.";
      } catch (error) {
        note.textContent = error.message || String(error);
      } finally {
        busy = false;
      }
    }

    scanButton.onclick = async () => {
      if (starting || running || document.documentElement.dataset.questPaused === "true") {
        return;
      }

      starting = true;
      const startVersion = navigationPauseVersion;
      scanButton.disabled = true;
      note.textContent = "Opening camera…";

      try {
        await loadScannerLibrary();

        if(document.documentElement.dataset.questPaused==='true'||startVersion!==navigationPauseVersion)return;

        scanner = new window.Html5Qrcode("reader");
        const sessionScanner = scanner;
        let startupScan = null;
        const scannerConfig = {fps:10};
        if(window.Html5QrcodeSupportedFormats?.QR_CODE !== undefined)scannerConfig.formatsToSupport=[window.Html5QrcodeSupportedFormats.QR_CODE];

        await scanner.start(
          { facingMode: "environment" },
          scannerConfig,
          text => {
            if(sessionScanner!==scanner||startVersion!==navigationPauseVersion)return;
            note.textContent='QR code detected. Checking your checkpoint...';
            if(starting&&!running){startupScan=text;return;}
            return onScan(text);
          },
          () => {}
        );

        running = true;
        stopButton.hidden = false;

        if (document.hidden || document.documentElement.dataset.questPaused === "true" || startVersion!==navigationPauseVersion) {
          await halt();
          note.textContent = "Camera stopped.";
        } else {
          note.textContent =
            "Point your camera at a checkpoint QR code.";
          if(startupScan!==null)await onScan(startupScan);
        }
      } catch (error) {
        await halt();

        console.warn('Checkpoint camera unavailable',error);
        note.textContent = "Camera unavailable. Enter the checkpoint code instead, or try again after allowing camera access.";
        if($('checkpoint-code-form').hidden)$('checkpoint-code-toggle').click();
      } finally {
        starting = false;
      }
    };

    stopButton.onclick = async () => {
      await halt();
      note.textContent = "Camera stopped.";
    };

    document.addEventListener('campus-navigation-pause', async event => {
      if(event.detail.paused){navigationPauseVersion++;if(!starting)await halt();note.textContent='Camera paused for the quest. Resume scanning after returning to your route.';}
      scanButton.disabled=document.documentElement.dataset.questPaused==='true';
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && running) {
        void halt().then(() => {
          note.textContent = "Camera stopped.";
        });
      }
    });
  }
})();
