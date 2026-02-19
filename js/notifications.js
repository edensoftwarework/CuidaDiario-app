/**
 * notifications.js - Sistema de notificaciones y recordatorios
 * by EDEN SoftWork
 * 
 * Gestiona notificaciones del navegador y recordatorios automáticos
 */

const Notifications = {
    permission: 'default',
    
    /**
     * Inicializar el sistema de notificaciones
     */
    async init() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
            
            if (this.permission === 'default') {
                // Pedir permiso al usuario
                this.permission = await Notification.requestPermission();
            }
        }
        
        // Iniciar comprobación periódica de recordatorios
        this.startPeriodicCheck();
    },

    /**
     * Comprobar si hay permisos para notificaciones
     * @returns {boolean}
     */
    hasPermission() {
        return this.permission === 'granted';
    },

    /**
     * Solicitar permiso para notificaciones
     */
    async requestPermission() {
        if ('Notification' in window && this.permission !== 'granted') {
            this.permission = await Notification.requestPermission();
            return this.permission === 'granted';
        }
        return false;
    },

    /**
     * Mostrar notificación
     * @param {string} title - Título de la notificación
     * @param {Object} options - Opciones de la notificación
     */
    show(title, options = {}) {
        if (!this.hasPermission()) {
            // Si no hay permisos, mostrar alerta en la página
            this.showInPageAlert(title, options.body);
            return;
        }

        const notification = new Notification(title, {
            icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💊</text></svg>',
            badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="0.9em" font-size="90">💊</text></svg>',
            ...options
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
            if (options.onClick) {
                options.onClick();
            }
        };

        // Auto cerrar después de 10 segundos
        setTimeout(() => notification.close(), 10000);
    },

    /**
     * Mostrar alerta en la página cuando no hay permisos de notificación
     * @param {string} title - Título
     * @param {string} message - Mensaje
     */
    showInPageAlert(title, message) {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning';
        alertDiv.innerHTML = `
            <div class="alert-icon">⏰</div>
            <div class="alert-content">
                <h4>${title}</h4>
                <p>${message || ''}</p>
            </div>
            <button class="btn-icon" onclick="this.parentElement.remove()">✕</button>
        `;

        alertsContainer.insertBefore(alertDiv, alertsContainer.firstChild);

        // Auto remover después de 30 segundos
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 30000);
    },

    /**
     * Iniciar comprobación periódica de recordatorios
     */
    startPeriodicCheck() {
        // Comprobar cada minuto
        setInterval(() => {
            this.checkMedicamentos();
            this.checkCitas();
            this.checkTareas();
        }, 60000); // 60 segundos

        // Comprobar inmediatamente al cargar
        setTimeout(() => {
            this.checkMedicamentos();
            this.checkCitas();
            this.checkTareas();
        }, 2000);
    },

    /**
     * Comprobar recordatorios de medicamentos
     */
    async checkMedicamentos() {
        const medicamentos = await Storage.getMedicamentos();
        if (!medicamentos || !Array.isArray(medicamentos)) return;
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        medicamentos.forEach(med => {
            if (!med.recordatorio) return;

            const horarios = this.getMedicamentoHorarios(med);
            
            horarios.forEach(hora => {
                if (hora === currentTime) {
                    // Verificar si ya se notificó en esta hora
                    const notifiedKey = `notified_med_${med.id}_${currentTime}`;
                    const lastNotified = localStorage.getItem(notifiedKey);
                    const today = now.toDateString();

                    if (lastNotified !== today) {
                        this.show(
                            `Recordatorio de Medicamento`,
                            {
                                body: `Es hora de tomar: ${med.nombre} - ${med.dosis}`,
                                tag: `med-${med.id}`,
                                requireInteraction: true
                            }
                        );
                        localStorage.setItem(notifiedKey, today);
                    }
                }
            });
        });
    },

    /**
     * Obtener horarios de un medicamento
     * @param {Object} medicamento
     * @returns {Array} - Array de horarios en formato HH:MM
     */
    getMedicamentoHorarios(medicamento) {
        const horarios = [];
        
        if (medicamento.frecuencia === 'custom' && medicamento.horariosCustom) {
            return medicamento.horariosCustom.split(',').map(h => h.trim());
        }

        if (!medicamento.horaInicio) return horarios;

        const [hora, minutos] = medicamento.horaInicio.split(':').map(Number);
        
        const frecuencias = {
            'cada-4h': 4,
            'cada-6h': 6,
            'cada-8h': 8,
            'cada-12h': 12,
            'diaria': 24
        };

        const intervalo = frecuencias[medicamento.frecuencia] || 24;
        let currentHora = hora;

        // Generar horarios del día
        while (currentHora < 24) {
            horarios.push(`${String(currentHora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`);
            currentHora += intervalo;
        }

        return horarios;
    },

    /**
     * Comprobar recordatorios de citas
     */
    async checkCitas() {
        const citas = await Storage.getCitas();
        if (!citas || !Array.isArray(citas)) return;
        
        const now = new Date();

        citas.forEach(cita => {
            if (!cita.recordatorio || cita.recordatorio === '0') return;

            const citaFecha = new Date(`${cita.fecha}T${cita.hora}`);
            const minutosAntes = parseInt(cita.recordatorio);
            const tiempoRecordatorio = new Date(citaFecha.getTime() - minutosAntes * 60000);

            // Comprobar si es el momento de recordar (con margen de 1 minuto)
            const diff = tiempoRecordatorio.getTime() - now.getTime();
            
            if (diff > 0 && diff < 60000) {
                const notifiedKey = `notified_cita_${cita.id}`;
                if (!sessionStorage.getItem(notifiedKey)) {
                    let tiempoTexto = '';
                    if (minutosAntes < 60) {
                        tiempoTexto = `en ${minutosAntes} minutos`;
                    } else if (minutosAntes === 60) {
                        tiempoTexto = 'en 1 hora';
                    } else if (minutosAntes === 1440) {
                        tiempoTexto = 'mañana';
                    } else {
                        tiempoTexto = `en ${Math.floor(minutosAntes / 1440)} días`;
                    }

                    this.show(
                        'Recordatorio de Cita',
                        {
                            body: `${cita.titulo} - ${tiempoTexto}\n${cita.lugar || ''}`,
                            tag: `cita-${cita.id}`,
                            requireInteraction: true
                        }
                    );
                    sessionStorage.setItem(notifiedKey, 'true');
                }
            }
        });
    },

    /**
     * Comprobar recordatorios de tareas
     */
    async checkTareas() {
        const tareas = await Storage.getTareas();
        if (!tareas || !Array.isArray(tareas)) return;
        
        const tareasPendientes = tareas.filter(t => !t.completada);
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        tareasPendientes.forEach(tarea => {
            if (!tarea.recordatorio || tarea.fecha !== today) return;

            if (tarea.hora) {
                const [hora, minutos] = tarea.hora.split(':').map(Number);
                const tareaTime = new Date(now);
                tareaTime.setHours(hora, minutos, 0, 0);

                // Notificar 15 minutos antes
                const recordatorioTime = new Date(tareaTime.getTime() - 15 * 60000);
                const diff = recordatorioTime.getTime() - now.getTime();

                if (diff > 0 && diff < 60000) {
                    const notifiedKey = `notified_tarea_${tarea.id}_${today}`;
                    if (!sessionStorage.getItem(notifiedKey)) {
                        this.show(
                            'Recordatorio de Tarea',
                            {
                                body: `Próxima tarea: ${tarea.titulo}`,
                                tag: `tarea-${tarea.id}`
                            }
                        );
                        sessionStorage.setItem(notifiedKey, 'true');
                    }
                }
            }
        });
    },

    /**
     * Verificar si hay alertas urgentes para el dashboard
     * @returns {Array} - Array de alertas
     */
    getUrgentAlerts() {
        const alerts = [];
        const now = new Date();

        // Medicamentos próximos (próxima hora)
        const medicamentos = Storage.getMedicamentos();
        const nextHour = new Date(now.getTime() + 60 * 60000);
        
        medicamentos.forEach(med => {
            if (!med.recordatorio) return;
            
            const horarios = this.getMedicamentoHorarios(med);
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const nextHourTime = `${String(nextHour.getHours()).padStart(2, '0')}:${String(nextHour.getMinutes()).padStart(2, '0')}`;
            
            horarios.forEach(hora => {
                if (hora >= currentTime && hora <= nextHourTime) {
                    alerts.push({
                        type: 'urgent',
                        icon: '💊',
                        title: 'Medicamento próximo',
                        message: `${med.nombre} a las ${hora}`,
                        time: hora
                    });
                }
            });
        });

        // Citas de hoy
        const today = now.toISOString().split('T')[0];
        const citas = Storage.getCitas().filter(c => c.fecha === today);
        
        citas.forEach(cita => {
            const citaTime = new Date(`${cita.fecha}T${cita.hora}`);
            if (citaTime > now) {
                alerts.push({
                    type: 'warning',
                    icon: '📅',
                    title: 'Cita médica hoy',
                    message: `${cita.titulo} a las ${cita.hora}`,
                    time: cita.hora
                });
            }
        });

        // Tareas pendientes de hoy
        const tareasPendientes = Storage.getTareas().filter(t => 
            !t.completada && t.fecha === today
        );

        if (tareasPendientes.length > 0) {
            alerts.push({
                type: 'info',
                icon: '✓',
                title: 'Tareas pendientes',
                message: `Tienes ${tareasPendientes.length} tarea(s) pendiente(s) para hoy`,
                time: null
            });
        }

        return alerts.sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });
    }
};

// Inicializar al cargar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Notifications.init());
} else {
    Notifications.init();
}

// Exponer globalmente
window.Notifications = Notifications;
