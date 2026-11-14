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
