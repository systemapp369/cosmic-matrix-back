/* Compatibility layer for the existing InfrastructureMonitor lifecycle. */
if (typeof HexTower3D !== 'undefined') {
  HexTower3D.prototype.renderHexTowerPanel = function () {
    this.renderDashboardShell();
  };
  HexTower3D.prototype.hexNextPage = function () {};
  HexTower3D.prototype.hexPrevPage = function () {};
}
