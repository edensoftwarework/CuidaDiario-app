/**
 * storage.js - Sistema de almacenamiento para CuidaDiario
 * by EDEN SoftWork
 * 
 * Ahora usa la API del backend en lugar de localStorage para datos principales
 * Mantiene localStorage solo para configuraciones locales
 */

const Storage = {
    // Claves de almacenamiento local
    KEYS: {
        PREMIUM_STATUS: 'cuidadiario_premium',
        SETTINGS: 'cuidadiario_settings',
        WELCOME_SHOWN: 'cuidadiario_welcome_shown',
        HISTORIAL_MEDICAMENTOS: 'cuidadiario_historial_medicamentos',
        SIGNOS_VITALES: 'cuidadiario_signos_vitales'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error al leer datos:', error);
            return null;
        }
    },

    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error al guardar datos:', error);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        API.logout();
    },

    // ========== MEDICAMENTOS (API) ==========
    async getMedicamentos() {
        try {
            return await API.getMedicamentos();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addMedicamento(medicamento) {
        try {
            return await API.createMedicamento(medicamento);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar: ' + error.message);
            throw error;
        }
    },

    async updateMedicamento(id, updates) {
        try {
            return await API.updateMedicamento(id, updates);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar: ' + error.message);
            throw error;
        }
    },

    async deleteMedicamento(id) {
        try {
            return await API.deleteMedicamento(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== CITAS (API) ==========
    async getCitas() {
        try {
            return await API.getCitas();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addCita(cita) {
        try {
            return await API.createCita(cita);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar: ' + error.message);
            throw error;
        }
    },

    async updateCita(id, updates) {
        try {
            return await API.updateCita(id, updates);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar: ' + error.message);
            throw error;
        }
    },

    async deleteCita(id) {
        try {
            return await API.deleteCita(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== TAREAS (API) ==========
    async getTareas() {
        try {
            return await API.getTareas();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addTarea(tarea) {
        try {
            return await API.createTarea(tarea);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar: ' + error.message);
            throw error;
        }
    },

    async updateTarea(id, updates) {
        try {
            return await API.updateTarea(id, updates);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar: ' + error.message);
            throw error;
        }
    },

    async deleteTarea(id) {
        try {
            return await API.deleteTarea(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== SÍNTOMAS (API) ==========
    async getSintomas() {
        try {
            return await API.getSintomas();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addSintoma(sintoma) {
        try {
            return await API.createSintoma(sintoma);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar: ' + error.message);
            throw error;
        }
    },

    async deleteSintoma(id) {
        try {
            return await API.deleteSintoma(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== CONTACTOS (API) ==========
    async getContactos() {
        try {
            return await API.getContactos();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addContacto(contacto) {
        try {
            return await API.createContacto(contacto);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar: ' + error.message);
            throw error;
        }
    },

    async updateContacto(id, updates) {
        try {
            return await API.updateContacto(id, updates);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar: ' + error.message);
            throw error;
        }
    },

    async deleteContacto(id) {
        try {
            return await API.deleteContacto(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== HISTORIAL Y SIGNOS (localStorage) ==========
    getHistorialMedicamentos() {
        return this.get(this.KEYS.HISTORIAL_MEDICAMENTOS) || [];
    },

    addHistorialMedicamento(registro) {
        const historial = this.getHistorialMedicamentos();
        registro.id = Date.now().toString();
        registro.fecha = new Date().toISOString();
        historial.push(registro);
        if (historial.length > 1000) historial.shift();
        this.set(this.KEYS.HISTORIAL_MEDICAMENTOS, historial);
        return registro;
    },

    getSignosVitales() {
        return this.get(this.KEYS.SIGNOS_VITALES) || [];
    },

    saveSignosVitales(signos) {
        return this.set(this.KEYS.SIGNOS_VITALES, signos);
    },

    addSignoVital(signo) {
        const signos = this.getSignosVitales();
        signo.id = Date.now().toString();
        signos.push(signo);
        if (signos.length > 500) signos.shift();
        this.saveSignosVitales(signos);
        return signo;
    },

    deleteSignoVital(id) {
        const signos = this.getSignosVitales();
        const filtered = signos.filter(s => s.id !== id);
        this.saveSignosVitales(filtered);
    },

    // ========== PREMIUM ==========
    getPremiumStatus() {
        return this.get(this.KEYS.PREMIUM_STATUS) || false;
    },

    setPremiumStatus(status) {
        return this.set(this.KEYS.PREMIUM_STATUS, status);
    },

    // ========== SETTINGS ==========
    getSettings() {
        return this.get(this.KEYS.SETTINGS) || {
            notificationsEnabled: false,
            theme: 'light'
        };
    },

    saveSettings(settings) {
        return this.set(this.KEYS.SETTINGS, settings);
    },

    // ========== WELCOME ==========
    isWelcomeShown() {
        return this.get(this.KEYS.WELCOME_SHOWN) || false;
    },

    setWelcomeShown() {
        return this.set(this.KEYS.WELCOME_SHOWN, true);
    },

    // ========== STATS ==========
    async getStats() {
        try {
            const [medicamentos, citas, tareas, sintomas, contactos] = await Promise.all([
                this.getMedicamentos(),
                this.getCitas(),
                this.getTareas(),
                this.getSintomas(),
                this.getContactos()
            ]);

            return {
                medicamentos: medicamentos.length,
                citas: citas.length,
                tareas: tareas.length,
                sintomas: sintomas.length,
                contactos: contactos.length
            };
        } catch (error) {
            console.error('Error al obtener stats:', error);
            return {
                medicamentos: 0,
                citas: 0,
                tareas: 0,
                sintomas: 0,
                contactos: 0
            };
        }
    },

    // ========== LÍMITES FREEMIUM ==========
    canAddMore(type, current) {
        const isPremium = this.getPremiumStatus();
        if (isPremium) return true;

        const limits = {
            medicamentos: 3,
            tareas: 3,
            contactos: 3
        };

        return current < (limits[type] || Infinity);
    },

    // Verificar límites de uso
    async checkLimits() {
        const isPremium = this.getPremiumStatus();
        
        if (isPremium) {
            return {
                medicamentos: { current: 999, max: 999, exceeded: false },
                tareas: { current: 999, max: 999, exceeded: false },
                contactos: { current: 999, max: 999, exceeded: false }
            };
        }

        const [medicamentos, tareas, contactos] = await Promise.all([
            this.getMedicamentos(),
            this.getTareas(),
            this.getContactos()
        ]);

        return {
            medicamentos: {
                current: medicamentos.length,
                max: 3,
                exceeded: medicamentos.length >= 3
            },
            tareas: {
                current: tareas.length,
                max: 3,
                exceeded: tareas.length >= 3
            },
            contactos: {
                current: contactos.length,
                max: 3,
                exceeded: contactos.length >= 3
            }
        };
    },

    // ========== EXPORTAR DATOS ==========
    async exportData() {
        try {
            const [medicamentos, citas, tareas, sintomas, contactos] = await Promise.all([
                this.getMedicamentos(),
                this.getCitas(),
                this.getTareas(),
                this.getSintomas(),
                this.getContactos()
            ]);

            return {
                medicamentos,
                citas,
                tareas,
                sintomas,
                contactos,
                historial: this.getHistorialMedicamentos(),
                signos: this.getSignosVitales(),
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error al exportar:', error);
            throw error;
        }
    }
};
