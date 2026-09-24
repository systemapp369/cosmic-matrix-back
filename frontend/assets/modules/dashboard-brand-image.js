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

            @media (max-width: 760px) {
                #cm-dashboard-v2 .cm-sidebar-brand-image-wrap {
                    max-width: 150px;
                }
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
