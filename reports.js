/**
 * reports.js - Sistema de reportes y exportación de datos
 * by EDEN SoftWork
 */

const Reports = {
    /**
     * Generar reporte completo
     */
    generarReporteCompleto() {
        if (!Storage.isPremium()) {
            showPremiumModal();
            return;
        }

        const desde = document.getElementById('reporteDesde').value;
        const hasta = document.getElementById('reporteHasta').value;

        if (!desde || !hasta) {
            alert('Por favor, selecciona un rango de fechas');
            return;
        }

        const data = this.getReporteData(desde, hasta);
        this.generarPDF(data, 'Reporte Completo');
    },

    /**
     * Generar reporte de medicamentos
     */
    generarReporteMedicamentos() {
        if (!Storage.isPremium()) {
            showPremiumModal();
            return;
        }

        const historial = Storage.getHistorialMedicamentos();
        const medicamentos = Storage.getMedicamentos();

        const html = this.generateMedicamentosHTML(medicamentos, historial);
        this.downloadHTML(html, 'reporte-medicamentos.html');
    },

    /**
     * Generar reporte médico
     */
    generarReporteMedico() {
        if (!Storage.isPremium()) {
            showPremiumModal();
            return;
        }

        const sintomas = Storage.getSintomas();
        const signos = Storage.getSignosVitales();
        const citas = Storage.getCitas();

        const html = this.generateMedicoHTML(sintomas, signos, citas);
        this.downloadHTML(html, 'reporte-medico.html');
    },

    /**
     * Obtener datos para reporte en rango de fechas
     */
    getReporteData(desde, hasta) {
        const fechaDesde = new Date(desde);
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);

        const filterByDate = (item, dateField) => {
            const itemDate = new Date(item[dateField]);
            return itemDate >= fechaDesde && itemDate <= fechaHasta;
        };

        return {
            periodo: { desde, hasta },
            medicamentos: Storage.getMedicamentos(),
            historialMed: Storage.getHistorialMedicamentos().filter(h => filterByDate(h, 'fecha')),
            citas: Storage.getCitas().filter(c => filterByDate({ fecha: c.fecha }, 'fecha')),
            sintomas: Storage.getSintomas().filter(s => filterByDate(s, 'fecha')),
            signos: Storage.getSignosVitales().filter(s => filterByDate(s, 'fecha')),
            tareas: Storage.getTareas().filter(t => filterByDate(t, 'fecha')),
            contactos: Storage.getContactos()
        };
    },

    /**
     * Generar HTML para reporte de medicamentos
     */
    generateMedicamentosHTML(medicamentos, historial) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte de Medicamentos - CuidaDiario</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        h1 { color: #4CAF50; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #2196F3; margin-top: 30px; }
        .medicamento { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .historial-item { padding: 10px; border-left: 3px solid #4CAF50; margin: 5px 0; }
        .fecha { color: #757575; font-size: 0.9em; }
        .logo { text-align: center; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="logo">
        <h1>CuidaDiario</h1>
        <p>by EDEN SoftWork</p>
    </div>
    
    <h1>Reporte de Medicamentos</h1>
    <p class="fecha">Generado: ${new Date().toLocaleString('es')}</p>
    
    <h2>Medicamentos Activos (${medicamentos.length})</h2>
    ${medicamentos.map(med => `
        <div class="medicamento">
            <h3>${med.nombre}</h3>
            <p><strong>Dosis:</strong> ${med.dosis}</p>
            <p><strong>Frecuencia:</strong> ${this.formatFrecuencia(med.frecuencia)}</p>
            ${med.horaInicio ? `<p><strong>Hora de inicio:</strong> ${med.horaInicio}</p>` : ''}
            ${med.notas ? `<p><strong>Notas:</strong> ${med.notas}</p>` : ''}
            <p><strong>Recordatorio:</strong> ${med.recordatorio ? 'Activado' : 'Desactivado'}</p>
        </div>
    `).join('')}
    
    <h2>Historial de Administración (${historial.length} registros)</h2>
    <table>
        <thead>
            <tr>
                <th>Fecha/Hora</th>
                <th>Medicamento</th>
                <th>Dosis</th>
                <th>Notas</th>
            </tr>
        </thead>
        <tbody>
            ${historial.slice(0, 100).map(h => `
                <tr>
                    <td>${new Date(h.fecha).toLocaleString('es')}</td>
                    <td>${h.medicamentoNombre}</td>
                    <td>${h.dosis}</td>
                    <td>${h.notas || '-'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ${historial.length > 100 ? '<p><em>Mostrando los últimos 100 registros</em></p>' : ''}
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #757575;">
        <p>CuidaDiario - by EDEN SoftWork</p>
        <p>Este reporte es confidencial y contiene información médica personal</p>
    </div>
</body>
</html>
        `;
    },

    /**
     * Generar HTML para reporte médico
     */
    generateMedicoHTML(sintomas, signos, citas) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Reporte Médico - CuidaDiario</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        h1 { color: #4CAF50; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
        h2 { color: #2196F3; margin-top: 30px; }
        .section { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .fecha { color: #757575; font-size: 0.9em; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #2196F3; color: white; }
        .sintoma { padding: 10px; border-left: 3px solid #FF9800; margin: 5px 0; background: white; }
        .intensidad { display: inline-block; padding: 3px 10px; border-radius: 15px; font-size: 0.9em; }
        .intensidad-alta { background: #ffebee; color: #c62828; }
        .intensidad-media { background: #fff3e0; color: #ef6c00; }
        .intensidad-baja { background: #e8f5e9; color: #2e7d32; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 20px;">
        <h1>CuidaDiario</h1>
        <p>by EDEN SoftWork</p>
    </div>
    
    <h1>Reporte Médico</h1>
    <p class="fecha">Generado: ${new Date().toLocaleString('es')}</p>
    
    <h2>Citas Médicas (${citas.length})</h2>
    <table>
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Lugar</th>
                <th>Profesional</th>
            </tr>
        </thead>
        <tbody>
            ${citas.slice(0, 50).map(c => `
                <tr>
                    <td>${new Date(c.fecha).toLocaleDateString('es')} ${c.hora}</td>
                    <td>${this.formatTipoCita(c.tipo)}</td>
                    <td>${c.titulo}</td>
                    <td>${c.lugar || '-'}</td>
                    <td>${c.profesional || '-'}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <h2>Síntomas Registrados (${sintomas.length})</h2>
    ${sintomas.slice(0, 30).map(s => {
        const intensidadClass = s.intensidad > 7 ? 'intensidad-alta' : s.intensidad > 4 ? 'intensidad-media' : 'intensidad-baja';
        return `
            <div class="sintoma">
                <p class="fecha">${new Date(s.fecha).toLocaleString('es')}</p>
                <p><strong>${s.tipo}</strong> <span class="intensidad ${intensidadClass}">Intensidad: ${s.intensidad}/10</span></p>
                ${s.estadoAnimo ? `<p>Estado de ánimo: ${this.formatEstadoAnimo(s.estadoAnimo)}</p>` : ''}
                ${s.descripcion ? `<p>${s.descripcion}</p>` : ''}
            </div>
        `;
    }).join('')}
    
    <h2>Signos Vitales</h2>
    ${this.generateSignosVitalesTable(signos)}
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #757575;">
        <p>CuidaDiario - by EDEN SoftWork</p>
        <p>Este reporte es confidencial y contiene información médica personal</p>
    </div>
</body>
</html>
        `;
    },

    /**
     * Generar tabla de signos vitales
     */
    generateSignosVitalesTable(signos) {
        const porTipo = {};
        signos.forEach(s => {
            if (!porTipo[s.tipo]) porTipo[s.tipo] = [];
            porTipo[s.tipo].push(s);
        });

        let html = '';
        Object.keys(porTipo).forEach(tipo => {
            html += `<h3>${this.formatSignoTipo(tipo)}</h3>`;
            html += '<table><thead><tr><th>Fecha/Hora</th><th>Valor</th><th>Notas</th></tr></thead><tbody>';
            porTipo[tipo].slice(0, 20).forEach(s => {
                html += `
                    <tr>
                        <td>${new Date(s.fecha).toLocaleString('es')}</td>
                        <td>${this.formatSignoValor(s)}</td>
                        <td>${s.notas || '-'}</td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
        });

        return html || '<p>No hay signos vitales registrados</p>';
    },

    /**
     * Exportar datos como JSON
     */
    exportarDatos() {
        if (!Storage.isPremium()) {
            showPremiumModal();
            return;
        }

        const data = Storage.exportAllData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cuidadiario-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('✓ Datos exportados correctamente');
    },

    /**
     * Importar datos desde JSON
     */
    importarDatos(event) {
        if (!Storage.isPremium()) {
            showPremiumModal();
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (confirm('¿Estás seguro de que quieres importar estos datos? Esto sobrescribirá los datos actuales.')) {
                    const success = Storage.importAllData(data);
                    if (success) {
                        alert('✓ Datos importados correctamente');
                        location.reload();
                    } else {
                        alert('✗ Error al importar datos');
                    }
                }
            } catch (error) {
                console.error('Error al leer archivo:', error);
                alert('✗ Error: Archivo no válido');
            }
        };
        reader.readAsText(file);
    },

    /**
     * Descargar HTML
     */
    downloadHTML(html, filename) {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('✓ Reporte generado correctamente');
    },

    /**
     * Generar PDF (simplificado - descarga HTML que se puede imprimir como PDF)
     */
    generarPDF(data, titulo) {
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${titulo} - CuidaDiario</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
        h1, h2 { color: #4CAF50; }
        .section { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #4CAF50; color: white; }
        @media print { body { margin: 0; } .no-print { display: none; } }
    </style>
</head>
<body>
    <div style="text-align: center; margin-bottom: 30px;">
        <h1>CuidaDiario</h1>
        <p>by EDEN SoftWork</p>
        <p class="no-print">Para guardar como PDF: Archivo → Imprimir → Guardar como PDF</p>
    </div>
    
    <h1>${titulo}</h1>
    <p>Período: ${new Date(data.periodo.desde).toLocaleDateString('es')} - ${new Date(data.periodo.hasta).toLocaleDateString('es')}</p>
    <p>Generado: ${new Date().toLocaleString('es')}</p>
    
    <div class="section">
        <h2>Resumen</h2>
        <ul>
            <li>Medicamentos activos: ${data.medicamentos.length}</li>
            <li>Administraciones registradas: ${data.historialMed.length}</li>
            <li>Citas médicas: ${data.citas.length}</li>
            <li>Síntomas registrados: ${data.sintomas.length}</li>
            <li>Signos vitales: ${data.signos.length}</li>
            <li>Tareas: ${data.tareas.length}</li>
        </ul>
    </div>
    
    ${this.generateMedicamentosHTML(data.medicamentos, data.historialMed)}
    ${this.generateMedicoHTML(data.sintomas, data.signos, data.citas)}
    
    <div class="section">
        <h2>Contactos de Emergencia</h2>
        <table>
            <thead>
                <tr><th>Nombre</th><th>Categoría</th><th>Teléfono</th></tr>
            </thead>
            <tbody>
                ${data.contactos.map(c => `
                    <tr>
                        <td>${c.nombre}</td>
                        <td>${c.categoria}</td>
                        <td>${c.telefono}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #757575;">
        <p>CuidaDiario - by EDEN SoftWork</p>
        <p>Este reporte es confidencial y contiene información personal de salud</p>
    </div>
</body>
</html>
        `;

        this.downloadHTML(html, `${titulo.toLowerCase().replace(/ /g, '-')}.html`);
    },

    // Funciones de formato
    formatFrecuencia(frecuencia) {
        const map = {
            'cada-4h': 'Cada 4 horas',
            'cada-6h': 'Cada 6 horas',
            'cada-8h': 'Cada 8 horas',
            'cada-12h': 'Cada 12 horas',
            'diaria': 'Diaria',
            'custom': 'Personalizada'
        };
        return map[frecuencia] || frecuencia;
    },

    formatTipoCita(tipo) {
        const map = {
            'consulta': 'Consulta médica',
            'estudio': 'Estudio/Análisis',
            'terapia': 'Terapia/Rehabilitación',
            'control': 'Control de rutina',
            'otro': 'Otro'
        };
        return map[tipo] || tipo;
    },

    formatEstadoAnimo(estado) {
        const map = {
            'excelente': '😊 Excelente',
            'bien': '🙂 Bien',
            'regular': '😐 Regular',
            'mal': '😟 Mal',
            'muy-mal': '😢 Muy mal'
        };
        return map[estado] || estado;
    },

    formatSignoTipo(tipo) {
        const map = {
            'presion': 'Presión Arterial',
            'glucosa': 'Glucosa',
            'temperatura': 'Temperatura',
            'peso': 'Peso'
        };
        return map[tipo] || tipo;
    },

    formatSignoValor(signo) {
        switch (signo.tipo) {
            case 'presion':
                return `${signo.sistolica}/${signo.diastolica} mmHg`;
            case 'glucosa':
                return `${signo.valor} mg/dL`;
            case 'temperatura':
                return `${signo.valor} °C`;
            case 'peso':
                return `${signo.valor} kg`;
            default:
                return signo.valor;
        }
    }
};

// Exponer funciones globales
window.generarReporteCompleto = () => Reports.generarReporteCompleto();
window.generarReporteMedicamentos = () => Reports.generarReporteMedicamentos();
window.generarReporteMedico = () => Reports.generarReporteMedico();
window.exportarDatos = () => Reports.exportarDatos();
window.importarDatos = (event) => Reports.importarDatos(event);

window.Reports = Reports;
