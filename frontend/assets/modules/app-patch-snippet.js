/**
 * app.js - parche de renderIndicatorsPanel() (2026-09-14)
 * Solo el método que pinta los anillos pequeños. El resto de la clase se conserva.
 * El cambio clave: destruimos el cache viejo de GlassRing3D antes de re-registrar,
 * para que register() reciba <div> NUEVOS (no stale).
 */
class InfrastructureMonitor {
    // ... resto de la clase sin cambios ...

    renderIndicatorsPanel() {
        const ringsContainer = document.getElementById('indicator-rings');
        const barsContainer = document.getElementById('indicator-bars');
        const heatstripContainer = document.getElementById('indicator-heatstrip');
        const iconRowsContainer = document.getElementById('indicator-icon-rows');
        const totalRing = document.getElementById('indicator-total-ring');
        const totalValue = document.getElementById('indicator-total-value');
        const totalLabel = document.getElementById('indicator-total-label');
        if (!ringsContainer || !barsContainer || !heatstripContainer || !iconRowsContainer) return;

        const total = this.projects.length;
        const avgProgress = total > 0
            ? Math.round(this.projects.reduce((s, p) => s + Number(p.progress || 0), 0) / total)
            : 0;

        if (totalLabel) totalLabel.textContent = `Promedio General · ${total} Activo${total === 1 ? '' : 's'}`;
        if (totalValue) totalValue.textContent = `${avgProgress}%`;
        if (this.glassRing3D && totalRing) {
            this.glassRing3D.register('indicator-total-ring', avgProgress, '#22d3ee');
        }

        // ── POSTFIX de Crystal Rings 2026-09-14 ──────────────────────────────
        // 1) Construye el HTML de los anillos pequeños (los <div> viejos mueren aquí)
        ringsContainer.innerHTML = this.projects.map(p => `
            <div class="text-center crystal-ring-cell">
                <div id="indicator-ring-${p.id}" class="position-relative mx-auto"
                     style="width:100px; height:100px;">
                    <span class="position-absolute top-50 start-50 translate-middle hud-ring-value crystal-ring-text"
                          style="z-index:6; pointer-events:none;">${p.progress}%</span>
                </div>
                <div class="small text-muted text-truncate mt-1 crystal-ring-label"
                     style="max-width:100px;" title="${this.escapeHtml(p.name)}">
                    ${this.escapeHtml(p.name)}
                </div>
            </div>
        `).join('') || `<div class="text-muted small">Sin proyectos activos.</div>`;

        // 2) Re-registrar todos los anillos pequeños. register() ahora detecta los <div>
        //    nuevos y recrea el canvas (incluyendo si quedó cache stale).
        if (this.glassRing3D) {
            this.projects.forEach(p => {
                const color = this.getLevelColor(p.level);
                this.glassRing3D.register(`indicator-ring-${p.id}`, p.progress, color);
            });
            // 3) Limpiar instancias que ya no correspondan a proyectos existentes.
            this.glassRing3D.pruneTo([
                'indicator-total-ring',
                ...this.projects.map(p => `indicator-ring-${p.id}`)
            ]);
        }
        // ─────────────────────────────────────────────────────────────────────

        // --- Barras horizontales + tira de calor ---
        barsContainer.innerHTML = this.projects.map(p => {
            const color = this.getLevelColor(p.level);
            return `
                <div>
                    <div class="d-flex justify-content-between small text-muted mb-1">
                        <span class="text-truncate" style="max-width:70%;">${this.escapeHtml(p.name)}</span>
                        <span class="font-monospace">${p.progress}%</span>
                    </div>
                    <div style="height:8px; background:rgba(148,163,184,0.15);">
                        <div style="height:100%; width:${p.progress}%; background:${color}; box-shadow:0 0 6px ${color};"></div>
                    </div>
                </div>
            `;
        }).join('') || `<div class="text-muted small">Sin proyectos activos.</div>`;

        heatstripContainer.innerHTML = this.projects.map(p => {
            const color = this.getLevelColor(p.level);
            const opacity = 0.25 + (p.progress / 100) * 0.75;
            return `<div class="hud-heat-cell" style="--cell-color:${color}; --cell-opacity:${opacity.toFixed(2)};" title="${this.escapeHtml(p.name)}: ${p.progress}%"></div>`;
        }).join('');

        // --- Filas de ícono + descripción (sin cambios) ---
        iconRowsContainer.innerHTML = this.projects.map((p) => {
            const idx = this.projects.findIndex(pr => pr.id === p.id);
            const color = this.getLevelColor(p.level);
            const icon = this.getIconForDescription(p.description);
            const desc = p.description
                ? this.escapeHtml(p.description)
                : '<span class="fst-italic text-muted">Sin descripción aún — agrégala en Editar.</span>';
            return `
                <div class="hud-icon-row" role="button" style="--hud-color:${color}; cursor:pointer;"
                    onclick="monitor.openModal(${idx})" title="Ver detalle de ${this.escapeHtml(p.name)}">
                    <span class="hud-icon-box" style="--hud-color:${color};"><i class="ti ${icon}"></i></span>
                    <div class="flex-grow-1" style="min-width:0;">
                        <div class="d-flex align-items-center justify-content-between gap-2">
                            <div class="fw-bold small text-truncate">${this.escapeHtml(p.name)}</div>
                            <div class="d-flex align-items-center gap-2 flex-shrink-0">
                                <button type="button" onclick="event.stopPropagation(); monitor.openBitacora(${idx});"
                                    class="btn btn-link btn-sm p-0 text-decoration-none text-info" title="Bitácora de Avances"
                                    style="font-size:0.7rem;">
                                    <i class="ti ti-folder"></i>
                                </button>
                                <button type="button" onclick="event.stopPropagation(); monitor.openModal(${idx});"
                                    class="btn btn-link btn-sm p-0 text-decoration-none text-primary" title="Editar"
                                    style="font-size:0.7rem;">
                                    <i class="ti ti-edit"></i>
                                </button>
                            </div>
                        </div>
                        <div class="small text-muted" style="font-size:0.7rem; line-height:1.2;">${desc}</div>
                    </div>
                </div>
            `;
        }).join('') || `<div class="text-muted small">Sin proyectos activos.</div>`;
    }
}
