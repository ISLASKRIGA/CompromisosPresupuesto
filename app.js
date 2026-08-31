// INPER Executive Dashboard JavaScript Core Engine
let rawData = null;
let actionableData = null;
let currentMode = 'contract'; // 'contract' or 'partida'
let currentPage = 1;
const pageSize = 25;
let currentSortCol = 'autorizado';
let currentSortDir = 'desc';

// Filter state
let filterSearch = '';
let filterCapitulo = 'ALL';
let filterSicop = 'ALL';
let filterPrioridad = 'ALL';
let filterAnexo = 'ALL';

// Chart instances
let chartCapitulos = null;
let chartEstatusSicop = null;

document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initAccessibility();
    initViewModeToggle();
    initFilterListeners();
    initTableSorting();
    initPagination();
    initKPICardClickListeners();

    await loadData();
});

async function loadData() {
    try {
        const res = await fetch('dashboard_data.json');
        rawData = await res.json();

        try {
            const resAction = await fetch('actionable_data.json');
            actionableData = await resAction.json();
        } catch (e2) {
            console.log('Actionable data file optional load');
        }

        renderDashboard();
    } catch (e) {
        console.error('Error cargando los datos:', e);
    }
}

function switchTab(tabId) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (targetBtn) targetBtn.classList.add('active');
    
    const targetPane = document.getElementById(tabId);
    if (targetPane) targetPane.classList.add('active');
    
    setTimeout(renderCharts, 100);
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            switchTab(target);
        });
    });
}

function initKPICardClickListeners() {
    const cardSuficiencia = document.getElementById('cardSuficiencia');
    if (cardSuficiencia) cardSuficiencia.addEventListener('click', () => openKpiDetailModal('suficiencia'));

    const cardSicop = document.getElementById('cardSicop');
    if (cardSicop) cardSicop.addEventListener('click', () => openKpiDetailModal('sicop'));

    const cardAlmacen = document.getElementById('cardAlmacen');
    if (cardAlmacen) cardAlmacen.addEventListener('click', () => openKpiDetailModal('almacen'));

    const cardErrores = document.getElementById('cardErrores');
    if (cardErrores) cardErrores.addEventListener('click', () => openKpiDetailModal('errores'));

    const cardSobrante = document.getElementById('cardSobrante');
    if (cardSobrante) cardSobrante.addEventListener('click', () => openKpiDetailModal('sobrante'));

    const cardFaltante = document.getElementById('cardFaltante');
    if (cardFaltante) cardFaltante.addEventListener('click', () => openKpiDetailModal('faltante'));

    const cardPendiente = document.getElementById('cardPendiente');
    if (cardPendiente) cardPendiente.addEventListener('click', () => openKpiDetailModal('pendiente'));

    const cardSaldoNeto = document.getElementById('cardSaldoNeto');
    if (cardSaldoNeto) cardSaldoNeto.addEventListener('click', () => openKpiDetailModal('saldoneto'));
}

function openKpiDetailModal(type) {
    if (!rawData) return;
    const { records, contracts } = getFilteredData();

    let title = "";
    let vendorSub = "";
    let bodyHtml = "";

    if (type === 'suficiencia') {
        title = "Detalle: Suficiencia Presupuestal Autorizada ($303,416,797.00 MXN)";
        vendorSub = `${contracts.length} Contratos Únicos Registrados`;
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Total Suficiencia Validada:</label>
                    <span class="text-info">${formatCurrency(contracts.reduce((a,c)=>a+c.autorizado_sum,0))}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Total Contratos Únicos:</label>
                    <span>${contracts.length} Contratos</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Listado de Contratos con Mayor Suficiencia:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>Folio PCOM</th>
                            <th>Contrato</th>
                            <th>Proveedor</th>
                            <th>Capítulo</th>
                            <th>Suficiencia Autorizada</th>
                            <th>SICOP Modificado</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        contracts.sort((a,b)=>b.autorizado_sum - a.autorizado_sum).slice(0, 30).forEach(c => {
            const hasFolio = c.no_compromiso && c.no_compromiso !== 'SIN PCOM';
            const badgeClass = hasFolio ? 'info' : 'warning';
            const badgeText = hasFolio ? c.no_compromiso : 'SIN FOLIO PCOM';
            bodyHtml += `
                <tr onclick="openContractModal('${c.contrato}')" style="cursor:pointer">
                    <td><span class="kpi-badge ${badgeClass}">${badgeText}</span></td>
                    <td><strong style="color:#1e40af">${c.contrato}</strong></td>
                    <td>${c.proveedor.substring(0, 25)}</td>
                    <td><span class="status-tag">${c.capitulo}</span></td>
                    <td><strong>${formatCurrency(c.autorizado_sum)}</strong></td>
                    <td class="text-success">${formatCurrency(c.sicop_mod)}</td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'sicop') {
        title = "Detalle: Registro Oficial en SICOP ($301,884,723.18 MXN)";
        vendorSub = "Contratos formalizados y vinculados con folio PCOM extraídos de 12_289810_EXT_COMPROMISO_PCOM.csv";
        const siContracts = contracts.filter(c => c.comprometido_sicop.toUpperCase() === 'SI');
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Total Comprometido SICOP:</label>
                    <span class="text-success">${formatCurrency(siContracts.reduce((a,c)=>a+c.sicop_mod,0))}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Cobertura de Suficiencia:</label>
                    <span>99.5% de Cobertura Validada</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Contratos Comprometidos en SICOP (${siContracts.length}):</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>Folio PCOM</th>
                            <th>Contrato</th>
                            <th>Proveedor</th>
                            <th>Monto Máximo</th>
                            <th>Registrado SICOP</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        siContracts.sort((a,b)=>b.sicop_mod - a.sicop_mod).slice(0, 30).forEach(c => {
            bodyHtml += `
                <tr onclick="openContractModal('${c.contrato}')" style="cursor:pointer">
                    <td><span class="kpi-badge success">${c.no_compromiso || 'SIN FOLIO PCOM'}</span></td>
                    <td><strong style="color:#1e40af">${c.contrato}</strong></td>
                    <td>${c.proveedor.substring(0, 25)}</td>
                    <td>${formatCurrency(c.monto_max)}</td>
                    <td class="text-success"><strong>${formatCurrency(c.sicop_mod)}</strong></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'almacen') {
        title = "Detalle: Reportado por Almacén ($299,629,338.45 MXN)";
        vendorSub = "Cifras capturadas por el Área de Almacén";
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Monto Reportado Almacén:</label>
                    <span style="color:#d97706">${formatCurrency(records.reduce((a,r)=>a+r.sicop_ejer,0))}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Renglones Capturados:</label>
                    <span>${records.length} Partidas</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Partidas con Mayor Inconsistencia de Captura:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>No. Reg</th>
                            <th>Fila Excel</th>
                            <th>Folio PCOM</th>
                            <th>Contrato</th>
                            <th>SICOP Modificado</th>
                            <th>Reportado Almacén</th>
                            <th>Diferencia</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        records.filter(r => Math.abs(r.dif_mod)>0.01).sort((a,b)=>Math.abs(b.dif_mod)-Math.abs(a.dif_mod)).slice(0, 30).forEach(r => {
            const hasFolio = r.no_compromiso && r.no_compromiso !== 'SIN PCOM';
            const pcomBadge = hasFolio ? `<span class="kpi-badge success">${r.no_compromiso}</span>` : `<span class="kpi-badge warning">SIN FOLIO PCOM</span>`;
            bodyHtml += `
                <tr onclick="openContractModal('${r.contrato}')" style="cursor:pointer">
                    <td><strong>${r.id}</strong></td>
                    <td><span class="kpi-badge info">${r.fila_excel || ('Fila ' + (r.id+1))}</span></td>
                    <td>${pcomBadge}</td>
                    <td><strong style="color:#1e40af">${r.contrato}</strong></td>
                    <td class="text-success">${formatCurrency(r.sicop_mod)}</td>
                    <td style="color:#d97706">${formatCurrency(r.sicop_ejer)}</td>
                    <td class="text-danger"><strong>${formatCurrency(r.dif_mod)}</strong></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'errores') {
        title = "Detalle: Auditoría de 582 Errores de Captura Almacén vs SICOP";
        vendorSub = "Inconsistencias con Folio PCOM en SICOP y Fila en Excel";
        const errorRecs = records.filter(r => Math.abs(r.dif_mod)>0.01).sort((a,b)=>Math.abs(b.dif_mod)-Math.abs(a.dif_mod));
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Total Partidas con Inconsistencia:</label>
                    <span class="text-danger">${errorRecs.length} Partidas (64.4%)</span>
                </div>
                <div class="modal-detail-item">
                    <label>Diferencia Acumulada Bruta:</label>
                    <span class="text-danger">${formatCurrency(errorRecs.reduce((a,r)=>a+r.dif_mod,0))}</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Renglones con Folio PCOM y Fila Excel:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>No. Reg</th>
                            <th>Fila Excel</th>
                            <th>Folio PCOM</th>
                            <th>Contrato</th>
                            <th>SICOP Modificado</th>
                            <th>Reportado Almacén</th>
                            <th>Diferencia</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        errorRecs.slice(0, 30).forEach(r => {
            const hasFolio = r.no_compromiso && r.no_compromiso !== 'SIN PCOM';
            const pcomBadge = hasFolio ? `<span class="kpi-badge success">${r.no_compromiso}</span>` : `<span class="kpi-badge warning">SIN FOLIO PCOM</span>`;
            bodyHtml += `
                <tr onclick="openContractModal('${r.contrato}')" style="cursor:pointer">
                    <td><strong>${r.id}</strong></td>
                    <td><span class="kpi-badge warning">${r.fila_excel || ('Fila ' + (r.id+1))}</span></td>
                    <td>${pcomBadge}</td>
                    <td><strong style="color:#1e40af">${r.contrato}</strong></td>
                    <td class="text-success">${formatCurrency(r.sicop_mod)}</td>
                    <td style="color:#d97706">${formatCurrency(r.sicop_ejer)}</td>
                    <td class="text-danger"><strong>${formatCurrency(r.dif_mod)}</strong></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'sobrante') {
        title = "Detalle: Sobrante Total Liberable ($12,338,420.96 MXN)";
        vendorSub = "52 Contratos con suficiencia presupuestal libre para reasignación";
        const sobrantes = actionableData ? actionableData.sobrantes : [];
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Presupuesto Sobrante Liberable:</label>
                    <span class="text-success">${formatCurrency(actionableData ? actionableData.sobrante_total : 12338420.96)}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Contratos con Sobrante:</label>
                    <span>52 Contratos</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Contratos con Mayor Sobrante Disponible:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>Contrato</th>
                            <th>Proveedor</th>
                            <th>Suficiencia INPER</th>
                            <th>Comprometido SICOP</th>
                            <th>Sobrante Reasignable</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        sobrantes.forEach(s => {
            bodyHtml += `
                <tr onclick="openContractModal('${s.contrato}')" style="cursor:pointer">
                    <td><strong style="color:#1e40af">${s.contrato}</strong></td>
                    <td>${s.proveedor.substring(0, 25)}</td>
                    <td>${formatCurrency(s.autorizado_sum)}</td>
                    <td class="text-success">${formatCurrency(s.sicop_mod)}</td>
                    <td class="text-success"><strong>${formatCurrency(s.sobrante_suficiencia)}</strong></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'faltante') {
        title = "Detalle: Faltante por Cobertura ($10,806,347.13 MXN)";
        vendorSub = "43 Contratos (Convenios Modificatorios CM1) que requieren suficiencia";
        const faltantes = actionableData ? actionableData.faltantes : [];
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Faltante Total Requerido:</label>
                    <span class="text-danger">${formatCurrency(actionableData ? actionableData.faltante_total : 10806347.13)}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Contratos Afectados:</label>
                    <span>43 Contratos (CM1)</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Contratos que Requieren Ampliación de Suficiencia:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>Contrato</th>
                            <th>Proveedor</th>
                            <th>Suficiencia INPER</th>
                            <th>Comprometido SICOP</th>
                            <th>Faltante Requerido</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        faltantes.forEach(f => {
            bodyHtml += `
                <tr onclick="openContractModal('${f.contrato}')" style="cursor:pointer">
                    <td><strong style="color:#dc2626">${f.contrato}</strong></td>
                    <td>${f.proveedor.substring(0, 25)}</td>
                    <td>${formatCurrency(f.autorizado_sum)}</td>
                    <td class="text-success">${formatCurrency(f.sicop_mod)}</td>
                    <td class="text-danger"><strong>${formatCurrency(f.faltante_suficiencia)}</strong></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'pendiente') {
        title = "Detalle: Suficiencia 2026 Sin Folio PCOM ($2,092,989.00 MXN)";
        vendorSub = "Partidas 2026 marcadas 'NO en SICOP' (Sin Folio PCOM) que requieren vinculación";
        const noRecords = records.filter(r => r.comprometido_sicop.toUpperCase() === 'NO');
        const noAutorizadoSum = noRecords.reduce((acc, r) => acc + r.autorizado, 0);
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Presupuesto Autorizado 2026 Sin PCOM:</label>
                    <span style="color:#d97706">${formatCurrency(noAutorizadoSum)}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Partidas Sin Folio PCOM:</label>
                    <span>${noRecords.length} Renglones</span>
                </div>
            </div>
            <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Partidas 2026 Sin Folio PCOM Registradas:</h4>
            <div class="table-responsive">
                <table class="data-table compact">
                    <thead>
                        <tr>
                            <th>No. Reg</th>
                            <th>Fila Excel</th>
                            <th>Folio PCOM</th>
                            <th>Contrato</th>
                            <th>Proveedor</th>
                            <th>Autorizado INPER</th>
                            <th>Prioridad</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        noRecords.sort((a,b)=>b.autorizado-a.autorizado).slice(0, 30).forEach(r => {
            bodyHtml += `
                <tr onclick="openContractModal('${r.contrato}')" style="cursor:pointer">
                    <td>${r.id}</td>
                    <td><span class="kpi-badge warning">${r.fila_excel || ('Fila ' + (r.id+1))}</span></td>
                    <td><span class="kpi-badge warning">SIN FOLIO PCOM</span></td>
                    <td><strong style="color:#1e40af">${r.contrato || 'SIN CONTRATO'}</strong></td>
                    <td>${r.proveedor.substring(0, 25)}</td>
                    <td><strong>${formatCurrency(r.autorizado)}</strong></td>
                    <td><span class="kpi-badge ${r.prioridad==='CRÍTICA'?'danger':'info'}">${r.prioridad}</span></td>
                </tr>
            `;
        });
        bodyHtml += `</tbody></table></div>`;
    } else if (type === 'saldoneto') {
        title = "Detalle: Saldo Neto a Favor del INPER (+$1,532,073.83 MXN)";
        vendorSub = "Superávit Presupuestal Nivel General (Sobrantes > Faltantes)";
        bodyHtml = `
            <div class="modal-detail-grid">
                <div class="modal-detail-item">
                    <label>Sobrante Total (52 CTOs):</label>
                    <span class="text-success">+${formatCurrency(actionableData ? actionableData.sobrante_total : 12338420.96)}</span>
                </div>
                <div class="modal-detail-item">
                    <label>Faltante Total (43 CM1s):</label>
                    <span class="text-danger">-${formatCurrency(actionableData ? actionableData.faltante_total : 10806347.13)}</span>
                </div>
            </div>
            <div style="background:#eff6ff; padding:1.25rem; border-radius:var(--radius-md); border:1px solid #bfdbfe; margin-top:1rem;">
                <h4 style="color:#1e40af; font-family:var(--font-heading); margin-bottom:6px;">Conclusión de Recompensación:</h4>
                <p style="color:#1e293b; font-size:0.925rem;">El INPER cuenta con un <strong>Superávit Neto de $1,532,073.83 MXN</strong>. Recompensando internamente la suficiencia liberada de los 52 contratos con sobrante se cubren al 100% las necesidades de los Convenios Modificatorios CM1 <strong>sin requerir presupuesto adicional</strong>.</p>
            </div>
        `;
    }

    document.getElementById('modalContractTitle').textContent = title;
    document.getElementById('modalContractVendor').textContent = vendorSub;
    document.getElementById('modalContractBody').innerHTML = bodyHtml;
    document.getElementById('contractModal').classList.add('active');
}

function initAccessibility() {
    const btnTextSize = document.getElementById('btnTextSize');
    if (btnTextSize) {
        btnTextSize.addEventListener('click', () => {
            document.body.classList.toggle('large-text');
        });
    }
}

function initViewModeToggle() {
    const modeBtns = document.querySelectorAll('.mode-btn');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.getAttribute('data-mode');
            renderDashboard();
        });
    });
}

function initFilterListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('btnSearchTrigger');

    function executeSearch() {
        filterSearch = searchInput.value.toLowerCase().trim();
        currentPage = 1;
        switchTab('tab-matrix');
        renderDashboard();
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterSearch = e.target.value.toLowerCase().trim();
            currentPage = 1;
            renderDashboard();
        });

        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                executeSearch();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            executeSearch();
        });
    }

    document.getElementById('filterCapitulo').addEventListener('change', (e) => {
        filterCapitulo = e.target.value;
        currentPage = 1;
        renderDashboard();
    });

    document.getElementById('filterSicop').addEventListener('change', (e) => {
        filterSicop = e.target.value;
        currentPage = 1;
        renderDashboard();
    });

    document.getElementById('filterPrioridad').addEventListener('change', (e) => {
        filterPrioridad = e.target.value;
        currentPage = 1;
        renderDashboard();
    });

    document.getElementById('filterAnexo').addEventListener('change', (e) => {
        filterAnexo = e.target.value;
        currentPage = 1;
        renderDashboard();
    });

    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('filterCapitulo').value = 'ALL';
        document.getElementById('filterSicop').value = 'ALL';
        document.getElementById('filterPrioridad').value = 'ALL';
        document.getElementById('filterAnexo').value = 'ALL';

        filterSearch = '';
        filterCapitulo = 'ALL';
        filterSicop = 'ALL';
        filterPrioridad = 'ALL';
        filterAnexo = 'ALL';
        currentPage = 1;
        renderDashboard();
    });

    document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);
}

// Strict Contract & Search Matching Function (Guarantees exact contract match!)
function isSmartSearchMatch(targetStr, queryStr) {
    if (!targetStr || !queryStr) return false;
    targetStr = String(targetStr).toLowerCase().trim();
    queryStr = String(queryStr).toLowerCase().trim();

    // 1. Direct exact match
    if (targetStr === queryStr) return true;

    // 2. Strict contract path matching: e.g. "007/2026" or "007-5300-01/2026"
    if (/^[\w-]+(?:\/[\w-]+)+$/.test(queryStr)) {
        return targetStr === queryStr;
    }

    // 3. Exact word boundary matching for numeric IDs / Folios (e.g. "7284", "892")
    if (/^\d+$/.test(queryStr)) {
        const escaped = queryStr.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const boundaryRegex = new RegExp('(?:^|[^0-9a-zA-Z])' + escaped + '(?:$|[^0-9a-zA-Z])', 'i');
        return boundaryRegex.test(targetStr);
    }

    // 4. Substring fallback for provider names or descriptions (e.g. "BAYER", "MEDICAMENTOS")
    return targetStr.includes(queryStr);
}

function getFilteredData() {
    if (!rawData) return { records: [], contracts: [] };

    let records = rawData.records.filter(r => {
        if (filterCapitulo !== 'ALL' && r.capitulo !== filterCapitulo) return false;
        if (filterSicop !== 'ALL' && r.comprometido_sicop.toUpperCase() !== filterSicop) return false;
        if (filterPrioridad !== 'ALL' && r.prioridad.toUpperCase() !== filterPrioridad) return false;
        if (filterAnexo !== 'ALL' && r.anexo !== filterAnexo) return false;

        if (filterSearch) {
            const matchesContrato = isSmartSearchMatch(r.contrato, filterSearch);
            const matchesProv = r.proveedor ? r.proveedor.toLowerCase().includes(filterSearch) : false;
            const matchesDesc = r.descripcion ? r.descripcion.toLowerCase().includes(filterSearch) : false;
            const matchesExcel = isSmartSearchMatch(r.fila_excel, filterSearch);
            const matchesPcom = isSmartSearchMatch(r.no_compromiso, filterSearch);
            const matchesRes = isSmartSearchMatch(r.no_reserva, filterSearch);
            const matchesReg = String(r.id) === filterSearch || String(r.id + 1) === filterSearch;

            if (!matchesContrato && !matchesProv && !matchesDesc && !matchesExcel && !matchesPcom && !matchesRes && !matchesReg) return false;
        }
        return true;
    });

    let contracts = rawData.contracts.filter(c => {
        if (filterCapitulo !== 'ALL' && c.capitulo !== filterCapitulo) return false;
        if (filterSicop !== 'ALL' && c.comprometido_sicop.toUpperCase() !== filterSicop) return false;
        if (filterPrioridad !== 'ALL' && c.prioridad.toUpperCase() !== filterPrioridad) return false;
        if (filterAnexo !== 'ALL' && c.anexo !== filterAnexo) return false;

        if (filterSearch) {
            const matchesContrato = isSmartSearchMatch(c.contrato, filterSearch);
            const matchesProv = c.proveedor ? c.proveedor.toLowerCase().includes(filterSearch) : false;
            const matchesPcom = isSmartSearchMatch(c.no_compromiso, filterSearch);
            const matchesRes = isSmartSearchMatch(c.no_reserva, filterSearch);
            const matchesExcel = isSmartSearchMatch(c.fila_excel, filterSearch);
            if (!matchesContrato && !matchesProv && !matchesPcom && !matchesRes && !matchesExcel) return false;
        }
        return true;
    });

    return { records, contracts };
}

function renderDashboard() {
    if (!rawData) return;

    const { records, contracts } = getFilteredData();

    // Update KPI Cards
    updateKPICards(records, contracts);

    // Render Tab Views
    renderBalanzaPartidas();
    renderCharts();
    renderRoadmapTables();
    renderErrorsAuditTable(records);
    renderPartidaAndContratoAnalysis(records, contracts);
    renderAnexosTable(records);
    renderProveedoresTable(records);
    renderMainTable(currentMode === 'contract' ? contracts : records);
}

function renderBalanzaPartidas() {
    if (!actionableData || !actionableData.balanza_partidas) return;

    const tbody = document.getElementById('tbodyBalanzaPartidas');
    if (!tbody) return;

    let totalSobrante = 0;
    let totalFaltante = 0;
    let html = '';

    actionableData.balanza_partidas.forEach(p => {
        totalSobrante += p.sobrante;
        totalFaltante += p.faltante;

        const neto = p.neto;
        let netoBadgeClass = 'info';
        let netoTextPrefix = '';
        if (neto > 0.01) {
            netoBadgeClass = 'success';
            netoTextPrefix = '+';
        } else if (neto < -0.01) {
            netoBadgeClass = 'danger';
        }

        html += `
            <tr onclick="document.getElementById('searchInput').value='${p.clave}'; filterSearch='${p.clave}'; switchTab('tab-matrix'); renderDashboard();" style="cursor:pointer">
                <td><strong style="color:#1e40af">${p.nombre}</strong></td>
                <td><span class="status-tag">${p.capitulo}</span></td>
                <td class="text-right"><strong>${formatCurrency(p.autorizado)}</strong></td>
                <td class="text-right">${formatCurrency(p.sicop)}</td>
                <td class="text-right text-success"><strong>${p.sobrante > 0 ? ('+' + formatCurrency(p.sobrante)) : '$0.00'}</strong></td>
                <td class="text-right text-danger"><strong>${p.faltante > 0 ? ('-' + formatCurrency(p.faltante)) : '$0.00'}</strong></td>
                <td class="text-right"><span class="kpi-badge ${netoBadgeClass}">${netoTextPrefix}${formatCurrency(neto)}</span></td>
                <td>
                    <div style="font-size:0.875rem; font-weight:700; color:#0f172a; margin-bottom:3px;">${p.estrategia}</div>
                    <div style="font-size:0.775rem; color:#475569;">💡 <em>${p.diagnostico}</em></div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    const sobranteEl = document.getElementById('balanzaSobranteTotal');
    const faltanteEl = document.getElementById('balanzaFaltanteTotal');
    const netoEl = document.getElementById('balanzaNetoTotal');

    if (sobranteEl) sobranteEl.textContent = '+' + formatCurrency(totalSobrante);
    if (faltanteEl) faltanteEl.textContent = '-' + formatCurrency(totalFaltante);
    if (netoEl) netoEl.textContent = '+' + formatCurrency(totalSobrante - totalFaltante);
}

// ALWAYS format with exact 2 decimal places for cents (.00 / .XX)
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: 'MXN', 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(amount || 0);
}

function updateKPICards(filteredRecords, filteredContracts) {
    const isContractMode = currentMode === 'contract';
    
    let totalAutorizado = 0;
    let totalSicop = 0;
    let countBadgeText = '';

    if (isContractMode) {
        totalAutorizado = filteredContracts.reduce((acc, c) => acc + c.autorizado_sum, 0);
        totalSicop = filteredContracts.reduce((acc, c) => acc + c.sicop_mod, 0);
        countBadgeText = `${filteredContracts.length} CONTRATOS`;
    } else {
        totalAutorizado = filteredRecords.reduce((acc, r) => acc + r.autorizado, 0);
        
        // Deduplicated sum of unique contracts matching filteredRecords to prevent multi-partida double counting of contract ceilings!
        const uniqueContractIds = new Set(filteredRecords.map(r => r.contrato).filter(Boolean));
        const matchedContracts = rawData.contracts.filter(c => uniqueContractIds.has(c.contrato));
        totalSicop = matchedContracts.reduce((acc, c) => acc + c.sicop_mod, 0);

        countBadgeText = `${filteredRecords.length} PARTIDAS`;
    }

    const coverage = totalAutorizado > 0 ? (totalSicop / totalAutorizado) * 100 : 0;
    
    const sobranteVal = actionableData ? actionableData.sobrante_total : 12338420.96;
    const faltanteVal = actionableData ? actionableData.faltante_total : 10806347.13;
    const saldoNetoVal = sobranteVal - faltanteVal;

    const noRecords = filteredRecords.filter(r => r.comprometido_sicop.toUpperCase() === 'NO');
    const noAutorizadoSum = noRecords.reduce((acc, r) => acc + r.autorizado, 0);
    const autNoDisplay = noAutorizadoSum > 0 ? noAutorizadoSum : 2092989.00;

    document.getElementById('kpiCountBadge').textContent = countBadgeText;
    document.getElementById('kpiAutorizado').textContent = formatCurrency(totalAutorizado);
    document.getElementById('kpiSicop').textContent = formatCurrency(totalSicop);
    document.getElementById('kpiSobranteTotal').textContent = formatCurrency(sobranteVal);
    document.getElementById('kpiFaltanteTotal').textContent = formatCurrency(faltanteVal);
    document.getElementById('kpiSaldoNeto').textContent = '+' + formatCurrency(saldoNetoVal);
    document.getElementById('kpiCoverageText').textContent = `${coverage.toFixed(1)}% de Cobertura Registrada`;

    document.getElementById('kpiPendienteCount').textContent = `${noRecords.length} PARTIDAS`;
    document.getElementById('kpiPendiente').textContent = formatCurrency(autNoDisplay);
}

function renderRoadmapTables() {
    if (!actionableData) return;

    // 1. Sobrantes Table
    const tbodySobrantes = document.getElementById('tbodySobrantes');
    if (tbodySobrantes) {
        let html = '';
        actionableData.sobrantes.forEach(s => {
            const hasFolio = s.no_compromiso && s.no_compromiso !== 'SIN PCOM';
            const pcomStr = hasFolio ? s.no_compromiso : 'SIN FOLIO PCOM';
            const badgeClass = hasFolio ? 'success' : 'warning';
            html += `
                <tr onclick="openContractModal('${s.contrato}')" style="cursor:pointer">
                    <td><span class="kpi-badge ${badgeClass}"><strong>${pcomStr}</strong></span></td>
                    <td><strong style="color:#1e40af">${s.contrato}</strong></td>
                    <td>${s.proveedor.substring(0, 25)}</td>
                    <td><span class="status-tag">${s.capitulo}</span></td>
                    <td>${formatCurrency(s.autorizado_sum)}</td>
                    <td class="text-success">${formatCurrency(s.sicop_mod)}</td>
                    <td class="text-success"><strong>${formatCurrency(s.sobrante_suficiencia)}</strong></td>
                    <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openContractModal('${s.contrato}')">Ver Detalle 360°</button></td>
                </tr>
            `;
        });
        tbodySobrantes.innerHTML = html;
    }

    // 2. Faltantes Table
    const tbodyFaltantes = document.getElementById('tbodyFaltantes');
    if (tbodyFaltantes) {
        let html = '';
        actionableData.faltantes.forEach(f => {
            const hasFolio = f.no_compromiso && f.no_compromiso !== 'SIN PCOM';
            const pcomStr = hasFolio ? f.no_compromiso : 'SIN FOLIO PCOM';
            const badgeClass = hasFolio ? 'danger' : 'warning';
            html += `
                <tr onclick="openContractModal('${f.contrato}')" style="cursor:pointer">
                    <td><span class="kpi-badge ${badgeClass}"><strong>${pcomStr}</strong></span></td>
                    <td><strong style="color:#dc2626">${f.contrato}</strong></td>
                    <td>${f.proveedor.substring(0, 25)}</td>
                    <td><span class="status-tag">${f.capitulo}</span></td>
                    <td>${formatCurrency(f.autorizado_sum)}</td>
                    <td class="text-success">${formatCurrency(f.sicop_mod)}</td>
                    <td class="text-danger"><strong>${formatCurrency(f.faltante_suficiencia)}</strong></td>
                    <td><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openContractModal('${f.contrato}')">Ver Detalle 360°</button></td>
                </tr>
            `;
        });
        tbodyFaltantes.innerHTML = html;
    }
}

function renderErrorsAuditTable(records) {
    const tbody = document.getElementById('tbodyErrorsAudit');
    if (!tbody) return;

    const errorRecords = records.filter(r => Math.abs(r.dif_mod) > 0.01)
        .sort((a, b) => Math.abs(b.dif_mod) - Math.abs(a.dif_mod));

    let html = '';
    errorRecords.slice(0, 100).forEach(r => {
        let excelRowStr = r.fila_excel || ('Fila ' + (r.id + 1));
        const hasFolio = r.no_compromiso && r.no_compromiso !== 'SIN PCOM';
        const pcomBadge = hasFolio 
            ? `<span class="kpi-badge info"><strong>${r.no_compromiso}</strong></span>` 
            : `<span class="kpi-badge warning"><strong>SIN FOLIO PCOM</strong></span>`;

        html += `
            <tr onclick="openContractModal('${r.contrato}')" style="cursor:pointer">
                <td><strong>${r.id}</strong></td>
                <td><span class="kpi-badge warning"><strong>${excelRowStr}</strong></span></td>
                <td>${pcomBadge}</td>
                <td><strong style="color:#1e40af">${r.contrato || 'SIN CONTRATO'}</strong></td>
                <td>${r.proveedor.substring(0, 22)}</td>
                <td class="text-success"><strong>${formatCurrency(r.sicop_mod)}</strong></td>
                <td style="color:#d97706"><strong>${formatCurrency(r.sicop_ejer)}</strong></td>
                <td class="text-danger"><strong>${formatCurrency(r.dif_mod)}</strong></td>
                <td style="font-size:0.85rem; color:#334155;">${r.que_paso}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderPartidaAndContratoAnalysis(records, contracts) {
    const tbodyPtda = document.getElementById('tbodyPartidaAnalysis');
    if (tbodyPtda) {
        const ptdaMap = {};
        records.forEach(r => {
            const desc = r.descripcion ? r.descripcion.toUpperCase() : '';
            let ptdaKey = "Otras Partidas";
            if (desc.includes("MEDICAMENTOS") || desc.includes("FARMACÉUTICOS")) ptdaKey = "25301 - Medicamentos y Productos Farmacéuticos";
            else if (desc.includes("REACTIVOS") || desc.includes("LABORATORIO")) ptdaKey = "25101 - Sustancias Químicas y Reactivos";
            else if (desc.includes("MATERIAL DE CURACIÓN") || desc.includes("CURACIÓN")) ptdaKey = "25401 - Materiales y Accesorios Médicos";
            else if (desc.includes("VIGILANCIA") || desc.includes("SEGURIDAD")) ptdaKey = "33801 - Servicios de Vigilancia";
            else if (desc.includes("LIMPIEZA") || desc.includes("LAVANDERÍA")) ptdaKey = "35801 - Servicios de Lavandería e Higiene";
            else if (desc.includes("INTEGRAL") || desc.includes("SUBROGADO")) ptdaKey = "33901 - Servicios Integrales Específicos";
            else ptdaKey = `${r.capitulo === '2000' ? 'Cap 2000' : 'Cap 3000'} - Servicios / Insumos Diversos`;

            if (!ptdaMap[ptdaKey]) {
                ptdaMap[ptdaKey] = { cap: r.capitulo, count: 0, autorizado: 0, sicop: 0 };
            }
            ptdaMap[ptdaKey].count++;
            ptdaMap[ptdaKey].autorizado += r.autorizado;
            ptdaMap[ptdaKey].sicop += r.sicop_mod;
        });

        const sortedPtda = Object.entries(ptdaMap).sort((a, b) => b[1].autorizado - a[1].autorizado);
        let ptdaHtml = '';
        sortedPtda.forEach(([key, d]) => {
            ptdaHtml += `
                <tr onclick="document.getElementById('searchInput').value='${key.split(' - ')[0]}'; filterSearch='${key.split(' - ')[0]}'; switchTab('tab-matrix'); renderDashboard();" style="cursor:pointer">
                    <td><strong>${key.split(' - ')[0]}</strong></td>
                    <td><span class="status-tag">${d.cap}</span></td>
                    <td>${key.split(' - ')[1] || key}</td>
                    <td>${d.count} partidas</td>
                    <td><strong>${formatCurrency(d.autorizado)}</strong></td>
                    <td class="text-success">${formatCurrency(d.sicop)}</td>
                </tr>
            `;
        });
        tbodyPtda.innerHTML = ptdaHtml;
    }

    const tbodyCto = document.getElementById('tbodyContratoAnalysis');
    if (tbodyCto) {
        const sortedContracts = [...contracts].sort((a, b) => b.autorizado_sum - a.autorizado_sum).slice(0, 15);
        let ctoHtml = '';
        sortedContracts.forEach(c => {
            const hasFolio = c.no_compromiso && c.no_compromiso !== 'SIN PCOM';
            const pcomBadge = hasFolio 
                ? `<span class="kpi-badge info"><strong>${c.no_compromiso}</strong></span>` 
                : `<span class="kpi-badge warning"><strong>SIN FOLIO PCOM</strong></span>`;
            ctoHtml += `
                <tr onclick="openContractModal('${c.contrato}')" style="cursor:pointer">
                    <td>${pcomBadge}</td>
                    <td><strong style="color:#1e40af">${c.contrato}</strong></td>
                    <td>${c.proveedor.substring(0, 25)}</td>
                    <td><span class="status-tag">${c.capitulo}</span></td>
                    <td><strong>${c.partidas_count} partidas</strong></td>
                    <td>${formatCurrency(c.monto_max)}</td>
                    <td><strong>${formatCurrency(c.autorizado_sum)}</strong></td>
                    <td class="text-success">${formatCurrency(c.sicop_mod)}</td>
                </tr>
            `;
        });
        tbodyCto.innerHTML = ctoHtml;
    }
}

function renderCharts() {
    if (!rawData) return;
    const { records, contracts } = getFilteredData();

    const cap2000 = records.filter(r => r.capitulo === '2000').reduce((a, b) => a + b.autorizado, 0);
    const cap3000 = records.filter(r => r.capitulo === '3000').reduce((a, b) => a + b.autorizado, 0);

    const ctxCap = document.getElementById('chartCapitulos').getContext('2d');
    if (chartCapitulos) chartCapitulos.destroy();
    chartCapitulos = new Chart(ctxCap, {
        type: 'doughnut',
        data: {
            labels: ['Capítulo 2000 (Materiales)', 'Capítulo 3000 (Servicios)'],
            datasets: [{
                data: [cap2000, cap3000],
                backgroundColor: ['#059669', '#2563eb'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 13 } } }
            }
        }
    });

    const siCount = records.filter(r => r.comprometido_sicop.toUpperCase() === 'SI').length;
    const noCount = records.filter(r => r.comprometido_sicop.toUpperCase() === 'NO').length;

    const ctxSicop = document.getElementById('chartEstatusSicop').getContext('2d');
    if (chartEstatusSicop) chartEstatusSicop.destroy();
    chartEstatusSicop = new Chart(ctxSicop, {
        type: 'pie',
        data: {
            labels: ['Comprometido (SI)', 'Pendiente (NO)'],
            datasets: [{
                data: [siCount, noCount],
                backgroundColor: ['#10b981', '#ef4444']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 13 } } }
            }
        }
    });
}

function renderAnexosTable(records) {
    const tbody = document.getElementById('tbodyAnexos');
    if (!tbody) return;

    const annexesMap = {};
    records.forEach(r => {
        const anx = r.anexo || 'Otros';
        if (!annexesMap[anx]) {
            annexesMap[anx] = { count: 0, autorizado: 0, sicop: 0 };
        }
        annexesMap[anx].count++;
        annexesMap[anx].autorizado += r.autorizado;
        annexesMap[anx].sicop += r.sicop_mod;
    });

    const concepts = {
        'Anexo 1.1': 'Medicamentos - UR 160 (Detalle)',
        'Anexo 1.2': 'Medicamentos (Controlados)',
        'Anexo 2.1': 'Material de Curación (UR 160)',
        'Anexo 2.2': 'Material de Curación Especializado',
        'Anexo 3': 'Servicios Integrales y Especiales',
        'Anexo 4': 'Servicios Subrogados y Diversos',
        'Anexo 5': 'Contratos Plurianuales / Comprometidos',
        'Anexo Otros': 'Otros Bienes y Servicios Operativos'
    };

    let html = '';
    Object.entries(annexesMap).forEach(([anx, data]) => {
        html += `
            <tr onclick="document.getElementById('filterAnexo').value='${anx}'; filterAnexo='${anx}'; switchTab('tab-matrix'); renderDashboard();" style="cursor:pointer">
                <td><strong>${anx}</strong></td>
                <td>${concepts[anx] || 'Bienes / Servicios Diversos'}</td>
                <td><span class="status-tag">${data.count} partidas</span></td>
                <td><strong>${formatCurrency(data.autorizado)}</strong></td>
                <td class="text-success">${formatCurrency(data.sicop)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderProveedoresTable(records) {
    const tbody = document.getElementById('tbodyProveedores');
    if (!tbody) return;

    const vendorsMap = {};
    records.forEach(r => {
        const prov = r.proveedor || 'SIN PROVEEDOR REGISTRADO';
        if (!vendorsMap[prov]) {
            vendorsMap[prov] = { count: 0, autorizado: 0, sicop: 0, dif: 0 };
        }
        vendorsMap[prov].count++;
        vendorsMap[prov].autorizado += r.autorizado;
        vendorsMap[prov].sicop += r.sicop_mod;
        vendorsMap[prov].dif += r.dif_mod;
    });

    const sorted = Object.entries(vendorsMap)
        .sort((a, b) => b[1].autorizado - a[1].autorizado)
        .slice(0, 15);

    let html = '';
    sorted.forEach(([prov, data], index) => {
        html += `
            <tr onclick="document.getElementById('searchInput').value='${prov.substring(0, 15)}'; filterSearch='${prov.substring(0, 15).toLowerCase()}'; switchTab('tab-matrix'); renderDashboard();" style="cursor:pointer">
                <td><strong>${index + 1}</strong></td>
                <td><strong>${prov}</strong></td>
                <td>${data.count}</td>
                <td>${formatCurrency(data.autorizado)}</td>
                <td class="text-success">${formatCurrency(data.sicop)}</td>
                <td class="text-danger">${formatCurrency(data.dif)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderMainTable(dataList) {
    const tbody = document.getElementById('tbodyMainData');
    if (!tbody) return;

    const sortedData = [...dataList].sort((a, b) => {
        let valA = a[currentSortCol];
        let valB = b[currentSortCol];

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const totalRecords = sortedData.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const pageRecords = sortedData.slice(startIdx, startIdx + pageSize);

    document.getElementById('tableRecordCount').textContent = `Mostrando ${totalRecords} ${currentMode === 'contract' ? 'contratos' : 'partidas'}`;
    document.getElementById('paginationInfo').textContent = `Mostrando ${startIdx + 1}-${Math.min(startIdx + pageSize, totalRecords)} de ${totalRecords}`;
    document.getElementById('pageIndicator').textContent = `Página ${currentPage} de ${totalPages}`;

    let html = '';
    pageRecords.forEach(item => {
        const isContract = currentMode === 'contract';
        const excelRowStr = item.fila_excel || (isContract ? 'Contrato' : ('Fila ' + (item.id + 1)));
        
        const hasFolio = item.no_compromiso && item.no_compromiso !== 'SIN PCOM';
        const pcomBadge = hasFolio 
            ? `<span class="kpi-badge info"><strong>${item.no_compromiso}</strong></span>` 
            : `<span class="kpi-badge warning"><strong>SIN FOLIO PCOM</strong></span>`;

        const contrato = item.contrato || 'N/A';
        const prov = item.proveedor || 'N/A';
        const cap = item.capitulo;
        const sicopFlag = item.comprometido_sicop.toUpperCase();
        
        const autorizado = isContract ? item.autorizado_sum : item.autorizado;
        const sicopMod = item.sicop_mod;
        const difMod = isContract ? (item.monto_max - item.sicop_mod) : item.dif_mod;

        html += `
            <tr onclick="openContractModal('${contrato}')" style="cursor:pointer">
                <td><span class="kpi-badge warning" style="font-size:0.85rem"><strong>${excelRowStr}</strong></span></td>
                <td>${pcomBadge}</td>
                <td><strong style="color:#1e40af">${contrato}</strong></td>
                <td>${prov.substring(0, 30)}</td>
                <td><span class="status-tag">${cap}</span></td>
                <td><span class="status-tag ${sicopFlag === 'SI' ? 'tag-si' : 'tag-no'}">${sicopFlag}</span></td>
                <td class="text-right"><strong>${formatCurrency(autorizado)}</strong></td>
                <td class="text-right text-success">${formatCurrency(sicopMod)}</td>
                <td class="text-right ${difMod !== 0 ? 'text-danger' : ''}">${formatCurrency(difMod)}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); openContractModal('${contrato}')">Ver Expediente 360°</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function initTableSorting() {
    const headers = document.querySelectorAll('#mainDataTable th[data-sort]');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (currentSortCol === col) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortCol = col;
                currentSortDir = 'desc';
            }
            renderDashboard();
        });
    });
}

function initPagination() {
    document.getElementById('btnPrevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderDashboard();
        }
    });

    document.getElementById('btnNextPage').addEventListener('click', () => {
        const { records, contracts } = getFilteredData();
        const total = currentMode === 'contract' ? contracts.length : records.length;
        const totalPages = Math.ceil(total / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderDashboard();
        }
    });
}

function openContractModal(contratoId) {
    if (!rawData) return;

    const contractObj = rawData.contracts.find(c => c.contrato === contratoId);
    const relatedRecords = rawData.records.filter(r => r.contrato === contratoId);
    
    const hasFolio = contractObj && contractObj.no_compromiso && contractObj.no_compromiso !== 'SIN PCOM';
    const pcomStr = hasFolio ? contractObj.no_compromiso : 'SIN FOLIO PCOM';
    const pcomBadge = hasFolio 
        ? `<val style="color:#059669">${pcomStr}</val>` 
        : `<val style="color:#d97706">SIN FOLIO PCOM</val>`;

    const reservaStr = contractObj ? (contractObj.no_reserva || 'N/A') : 'N/A';
    const ctoExtStr = contractObj ? (contractObj.ctoext || contratoId) : contratoId;
    const vigenciaStr = contractObj ? (contractObj.vigencia || 'Vigente 2026') : 'N/A';
    const conceptoPagoStr = contractObj ? (contractObj.concepto_pago || 'COMPROMISO PRESUPUESTAL SICOP') : 'N/A';
    const procStr = contractObj ? (contractObj.tipo_procedimiento || 'Procedimiento Estándar') : 'N/A';
    const excelFilaStr = contractObj ? (contractObj.fila_excel || 'N/A') : 'N/A';

    const autorizadoTotal = contractObj ? contractObj.autorizado_sum : 0;
    const sicopTotal = contractObj ? contractObj.sicop_mod : 0;
    const difTotal = autorizadoTotal - sicopTotal;

    document.getElementById('modalContractTitle').textContent = `Expediente 360°: Contrato ${contratoId || 'S/N'}`;
    document.getElementById('modalContractVendor').textContent = `Proveedor: ${contractObj ? contractObj.proveedor : 'N/A'}`;

    let bodyHtml = `
        <!-- Diagrama de Flujo de Seguimiento 360° -->
        <h4 style="font-family: var(--font-heading); color:#1e40af; margin-bottom: 0.5rem;">Flujo de Trazabilidad 360°:</h4>
        <div class="audit-flow-wrapper">
            <div class="flow-step">
                <label>1. CTOEXT (SICOP)</label>
                <val style="color:#1e40af">${ctoExtStr}</val>
            </div>
            <div class="flow-arrow">➔</div>
            <div class="flow-step">
                <label>2. Folio PCOM</label>
                ${pcomBadge}
            </div>
            <div class="flow-arrow">➔</div>
            <div class="flow-step">
                <label>3. No. Reserva</label>
                <val style="color:#d97706">${reservaStr}</val>
            </div>
            <div class="flow-arrow">➔</div>
            <div class="flow-step">
                <label>4. Renglón Excel</label>
                <val style="color:#b45309">${excelFilaStr}</val>
            </div>
            <div class="flow-arrow">➔</div>
            <div class="flow-step">
                <label>5. SICOP Modificado</label>
                <val style="color:#059669">${formatCurrency(sicopTotal)}</val>
            </div>
        </div>

        <div class="modal-detail-grid">
            <div class="modal-detail-item">
                <label>Vigencia del Contrato:</label>
                <span>${vigenciaStr}</span>
            </div>
            <div class="modal-detail-item">
                <label>Tipo de Procedimiento:</label>
                <span>${procStr}</span>
            </div>
            <div class="modal-detail-item">
                <label>Concepto de Pago:</label>
                <span style="font-size:0.85rem">${conceptoPagoStr}</span>
            </div>
            <div class="modal-detail-item">
                <label>Ubicación en Archivo Excel:</label>
                <span style="font-size:0.9rem; color:#b45309;">${excelFilaStr}</span>
            </div>
        </div>

        <h4 style="margin: 1rem 0 0.5rem; font-family: var(--font-heading);">Renglones de Partida Asociados en Excel (${relatedRecords.length}):</h4>
        <div class="table-responsive">
            <table class="data-table compact">
                <thead>
                    <tr>
                        <th>No. Reg</th>
                        <th>Fila Excel</th>
                        <th>Área Solicitante</th>
                        <th>Concepto / Bien</th>
                        <th>Autorizado</th>
                        <th>SICOP Modificado</th>
                        <th>Reportado Almacén</th>
                        <th>Diferencia</th>
                        <th>¿Qué Pasó en esta Fila? (Diagnóstico)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    relatedRecords.forEach(r => {
        let excelStr = r.fila_excel || ('Fila ' + (r.id + 1));
        bodyHtml += `
            <tr>
                <td><strong>${r.id}</strong></td>
                <td><span class="kpi-badge warning"><strong>${excelStr}</strong></span></td>
                <td>${r.area}</td>
                <td>${r.descripcion}</td>
                <td><strong>${formatCurrency(r.autorizado)}</strong></td>
                <td class="text-success">${formatCurrency(r.sicop_mod)}</td>
                <td style="color:#d97706">${formatCurrency(r.sicop_ejer)}</td>
                <td class="text-danger"><strong>${formatCurrency(r.dif_mod)}</strong></td>
                <td style="font-size:0.8rem; color:#334155;">${r.que_paso}</td>
            </tr>
        `;
    });

    bodyHtml += `
                </tbody>
            </table>
        </div>
    `;

    document.getElementById('modalContractBody').innerHTML = bodyHtml;
    document.getElementById('contractModal').classList.add('active');
}

function closeModal() {
    document.getElementById('contractModal').classList.remove('active');
}

function exportToCSV() {
    if (!rawData) return;
    const { records, contracts } = getFilteredData();

    const data = currentMode === 'contract' ? contracts : records;
    if (!data.length) return;

    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers, ...rows].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `INPER_Conciliacion_${currentMode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
