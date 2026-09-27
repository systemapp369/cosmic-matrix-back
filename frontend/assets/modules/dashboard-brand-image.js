(function () {
    'use strict';

    const BRAND_IMAGE = './Images/dashboard4.webp?v=20260924-1';

    function applyCosmicMatrixBrand() {
        const footer = document.querySelector('#cm-dashboard-v2 .cm-sidebar-footer');
        if (!footer) return false;

        footer.innerHTML = `
            <div class="cm-sidebar-brand-image-wrap">
                <img
                    class="cm-sidebar-brand-image"
                    src="${BRAND_IMAGE}"
                    alt="Cosmic Matrix"
                    loading="eager"
                    decoding="async"
                >
            </div>
            <div class="cm-sidebar-version">v3.5.0</div>
        `;

        return true;
    }

    function installBrandStyles() {
        if (document.getElementById('cm-sidebar-brand-image-styles')) return;

        const style = document.createElement('style');
        style.id = 'cm-sidebar-brand-image-styles';
        style.textContent = `
            #cm-dashboard-v2 .cm-sidebar-footer {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                justify-content: flex-end;
                padding: 12px 18px 18px;
                overflow: hidden;
                color: #6f9ab7;
            }

            #cm-dashboard-v2 .cm-sidebar-brand-image-wrap {
                width: 100%;
                max-width: 190px;
                margin-bottom: 10px;
                border-radius: 12px;
                overflow: hidden;
                background: #031326;
                box-shadow: 0 0 22px rgba(25, 217, 255, .10);
            }

            #cm-dashboard-v2 .cm-sidebar-brand-image {
                display: block;
                width: 100%;
                height: auto;
                max-height: 145px;
                object-fit: cover;
                object-position: center;
            }

            #cm-dashboard-v2 .cm-sidebar-version {
                color: #557f9d;
                font-size: 11px;
                letter-spacing: .04em;
            }

            /* =====================================================
               EDITOR HUD — distribución horizontal real.
               Se usan IDs, no nth-of-type, para evitar que Bootstrap
               vuelva a apilar los campos.
               ===================================================== */
            #crudModal .cm-editor-dialog {
                width: min(1420px, calc(100vw - 32px)) !important;
                max-width: min(1420px, calc(100vw - 32px)) !important;
                margin: 16px auto !important;
            }

            #crudModal .cm-editor-hud {
                --editor-cyan: #19e6f2;
                --editor-cyan-2: #56f7ff;
                --editor-bg: #041522;
                --editor-panel: rgba(4, 25, 39, .94);
                position: relative;
                overflow: hidden;
                border: 1px solid rgba(25,230,242,.72) !important;
                border-radius: 2px !important;
                color: #e8fbff;
                background:
                    linear-gradient(rgba(25,230,242,.028) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(25,230,242,.028) 1px, transparent 1px),
                    radial-gradient(circle at 50% 0%, rgba(18,155,190,.13), transparent 58%),
                    #03111d;
                background-size: 24px 24px,24px 24px,100% 100%,100% 100%;
                box-shadow: 0 0 34px rgba(0,210,255,.14), inset 0 0 70px rgba(0,210,255,.055);
            }

            #crudModal .cm-editor-hud::before,
            #crudModal .cm-editor-hud::after {
                content: "";
                position: absolute;
                pointer-events: none;
                z-index: 0;
                height: 18px;
                width: 220px;
                border-top: 2px solid var(--editor-cyan);
            }
            #crudModal .cm-editor-hud::before {
                top: 0; left: 0;
                border-left: 2px solid var(--editor-cyan);
                clip-path: polygon(0 0, 82% 0, 91% 100%, 100% 100%, 100% 0, 0 0);
            }
            #crudModal .cm-editor-hud::after {
                right: 0; bottom: 0;
                border-right: 2px solid var(--editor-cyan);
                border-bottom: 2px solid var(--editor-cyan);
            }

            #crudModal .cm-editor-hud .modal-header,
            #crudModal .cm-editor-hud .modal-body { position: relative; z-index: 1; }

            #crudModal .cm-editor-hud .modal-header {
                min-height: 104px;
                padding: 24px 38px 18px !important;
                border-bottom: 1px solid rgba(25,230,242,.28) !important;
                background: linear-gradient(90deg, rgba(18,213,231,.085), transparent 60%);
            }
            #crudModal .cm-editor-hud .modal-header::after {
                content: "SYSTEM  /  PROJECT EDITOR";
                position: absolute;
                right: 38px;
                bottom: 16px;
                color: rgba(89,221,234,.65);
                font: 11px 'Share Tech Mono', monospace;
                letter-spacing: .25em;
            }
            #crudModal .cm-editor-hud .modal-title {
                margin: 0;
                color: #f5fdff;
                font: 700 24px 'Orbitron', sans-serif;
                letter-spacing: .07em;
                text-transform: uppercase;
                text-shadow: 0 0 12px rgba(25,230,242,.28);
            }
            #crudModal .cm-editor-hud #modalSub {
                margin-top: 8px !important;
                color: #54c9d7 !important;
                font: 13px 'Share Tech Mono', monospace;
                letter-spacing: .2em;
                text-transform: uppercase;
            }
            #crudModal .cm-editor-hud .btn-close {
                filter: invert(1) sepia(1) saturate(3) hue-rotate(145deg);
                opacity: .85;
            }

            #crudModal .cm-editor-hud .modal-body {
                padding: 24px 38px 30px !important;
            }

            /* La distribución se fija por ID para que Bootstrap no la altere. */
            #crudModal #nodeForm {
                display: grid !important;
                grid-template-columns: minmax(0, 6fr) minmax(220px, 2fr) minmax(220px, 2fr) !important;
                grid-template-areas:
                    "name level progress"
                    "lead lead description"
                    "actions actions actions" !important;
                gap: 18px 22px !important;
                margin: 0 !important;
                width: 100% !important;
            }

            #crudModal #nodeForm > input[type="hidden"] { display: none !important; }
            #crudModal #nodeForm > div { width: auto !important; margin: 0 !important; padding: 0 !important; min-width: 0 !important; }
            #crudModal #nodeName { grid-area: name; }
            #crudModal #nodeLevel { grid-area: level; }
            #crudModal #nodeProgress { grid-area: progress; }
            #crudModal #nodeLead { grid-area: lead; }
            #crudModal #nodeDescription { grid-area: description; }
            #crudModal #nodeForm > div:nth-last-child(1) { grid-area: actions; }

            /* Los campos son hijos de cada celda; el grid se asigna al contenedor. */
            #crudModal #nodeName { width: 100%; }
            #crudModal #nodeLevel { width: 100%; }
            #crudModal #nodeProgress { width: 100%; }
            #crudModal #nodeLead { width: 100%; }
            #crudModal #nodeDescription { width: 100%; }

            /* Recolocación exacta de las celdas del formulario. */
            #crudModal #nodeForm > div:nth-of-type(1) { grid-area: name; }
            #crudModal #nodeForm > div:nth-of-type(2) { grid-area: level; }
            #crudModal #nodeForm > div:nth-of-type(3) { grid-area: progress; }
            #crudModal #nodeForm > div:nth-of-type(4) { grid-area: lead; }
            #crudModal #nodeForm > div:nth-of-type(5) { grid-area: description; }
            #crudModal #nodeForm > div:nth-of-type(6) { grid-area: actions; }

            #crudModal .cm-editor-hud .form-label {
                display: block;
                margin: 0 0 8px !important;
                color: #62bfca !important;
                font: 11px 'Share Tech Mono', monospace !important;
                letter-spacing: .2em;
                text-transform: uppercase;
            }
            #crudModal .cm-editor-hud .form-control,
            #crudModal .cm-editor-hud .form-select {
                width: 100% !important;
                height: 54px !important;
                min-height: 54px !important;
                border-radius: 0 !important;
                border: 1px solid rgba(53,174,194,.55) !important;
                background: rgba(2,17,29,.94) !important;
                color: #effdff !important;
                padding: 0 16px !important;
                font: 15px 'Share Tech Mono', monospace !important;
                box-shadow: inset 0 0 18px rgba(0,216,255,.045) !important;
            }
            #crudModal .cm-editor-hud .form-control:focus,
            #crudModal .cm-editor-hud .form-select:focus {
                border-color: var(--editor-cyan) !important;
                outline: none !important;
                box-shadow: 0 0 0 1px rgba(25,230,242,.35), 0 0 18px rgba(25,230,242,.13) !important;
            }
            #crudModal .cm-editor-hud #nodeProgress { font-size: 20px !important; font-weight: 700; }
            #crudModal .cm-editor-hud #nodeProgress::-webkit-inner-spin-button { filter: invert(1); }

            #crudModal #nodeForm > div:nth-of-type(6) {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                border-top: 1px solid rgba(25,230,242,.25) !important;
                padding-top: 18px !important;
                margin-top: 4px !important;
            }
            #crudModal #nodeForm > div:nth-of-type(6)::before {
                content: "CONTROL";
                margin-right: auto;
                color: #3f8791;
                font: 10px 'Share Tech Mono', monospace;
                letter-spacing: .22em;
            }
            #crudModal .cm-editor-hud .btn {
                min-height: 44px;
                padding: 9px 20px !important;
                border-radius: 0 !important;
                text-transform: uppercase;
                letter-spacing: .1em;
                font: 12px 'Share Tech Mono', monospace !important;
            }
            #crudModal .cm-editor-hud #submitBtn {
                background: #08bfd7 !important;
                border: 1px solid #61f5ff !important;
                color: #00151d !important;
                box-shadow: 0 0 16px rgba(25,230,242,.2);
            }
            #crudModal .cm-editor-hud .id-delete-btn { border-color: #ff426b !important; color: #ff6d8a !important; }
            #crudModal .cm-editor-hud .btn-light { background: #0b2536 !important; border-color: #356276 !important; color: #d5edf2 !important; }

            /* BITÁCORA: barra horizontal y luego historial en dos columnas. */
            #crudModal #updatesSection {
                display: grid !important;
                grid-template-columns: minmax(0, 2.3fr) minmax(250px, 1fr) auto !important;
                gap: 14px 18px !important;
                margin: 26px 0 0 !important;
                padding: 20px 0 0 !important;
                border-top: 1px solid rgba(25,230,242,.35) !important;
            }
            #crudModal #updatesSection.d-none { display: none !important; }
            #crudModal #updatesSection > h6 {
                grid-column: 1/-1;
                margin: 0 0 2px !important;
                color: #f0fcff !important;
                font: 700 15px 'Orbitron', sans-serif !important;
                letter-spacing: .12em;
                text-transform: uppercase;
            }
            #crudModal #updatesSection > h6::before { content: "//"; color: var(--editor-cyan); margin-right: 10px; }
            #crudModal #updatesSection #updateNote {
                grid-column: 1;
                height: 66px !important;
                resize: none;
                border-radius: 0 !important;
                margin: 0 !important;
                padding: 12px !important;
            }
            #crudModal #updatesSection #updateFiles {
                grid-column: 2;
                height: 66px !important;
                border-radius: 0 !important;
                margin: 0 !important;
                padding: 12px !important;
                font: 12px 'Share Tech Mono', monospace !important;
            }
            #crudModal #updatesSection > .d-flex.justify-content-end {
                grid-column: 3;
                align-items: center;
                margin: 0 !important;
                justify-content: flex-end !important;
            }
            #crudModal #updatesSection #addUpdateBtn {
                background: transparent !important;
                border: 1px solid var(--editor-cyan) !important;
                color: #7ef6ff !important;
                white-space: nowrap;
            }
            #crudModal #updatesSection #updatesList {
                grid-column: 1/-1;
                display: grid !important;
                grid-template-columns: repeat(2,minmax(0,1fr));
                gap: 10px !important;
                max-height: 230px !important;
                overflow-y: auto;
                padding-right: 4px;
            }
            #crudModal #updatesSection #updatesList > * {
                border-radius: 0 !important;
                border: 1px solid rgba(25,230,242,.2) !important;
                background: rgba(4,25,39,.72) !important;
            }

            @media (max-width: 900px) {
                #crudModal .cm-editor-dialog { width: calc(100vw - 18px) !important; max-width: calc(100vw - 18px) !important; }
                #crudModal .cm-editor-hud .modal-header,
                #crudModal .cm-editor-hud .modal-body { padding-left: 18px !important; padding-right: 18px !important; }
                #crudModal #nodeForm { grid-template-columns: 1fr 1fr !important; grid-template-areas: "name name" "level progress" "lead lead" "description description" "actions actions" !important; }
                #crudModal #updatesSection { grid-template-columns: 1fr !important; }
                #crudModal #updatesSection #updateNote,
                #crudModal #updatesSection #updateFiles,
                #crudModal #updatesSection > .d-flex.justify-content-end { grid-column: 1; }
                #crudModal #updatesSection #updatesList { grid-template-columns: 1fr; }
            }

            @media (max-width: 560px) {
                #crudModal #nodeForm { grid-template-columns: 1fr !important; grid-template-areas: "name" "level" "progress" "lead" "description" "actions" !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function boot() {
        installBrandStyles();
        if (applyCosmicMatrixBrand()) return;

        const observer = new MutationObserver(() => {
            if (applyCosmicMatrixBrand()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        window.setTimeout(() => observer.disconnect(), 15000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
