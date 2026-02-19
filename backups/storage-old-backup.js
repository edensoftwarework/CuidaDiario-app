/**
 * storage.js - Sistema de almacenamiento para CuidaDiario
 * by EDEN SoftWork
 * 
 * Ahora usa la API del backend en lugar de localStorage
 * Mantiene compatibilidad para datos locales (premium, settings)
 */

const Storage = {
    // Claves de almacenamiento local (solo para datos que no van al backend)
    KEYS: {
        PREMIUM_STATUS: 'cuidadiario_premium',
        SETTINGS: 'cuidadiario_settings',
        WELCOME_SHOWN: 'cuidadiario_welcome_shown',
        HISTORIAL_MEDICAMENTOS: 'cuidadiario_historial_medicamentos',
        SIGNOS_VITALES: 'cuidadiario_signos_vitales'
    },

    /**
     * Obtener datos de localStorage
     */
    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error al leer datos:', error);
            return null;
        }
    },

    /**
     * Guardar datos en localStorage
     */
    set(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Error al guardar datos:', error);
            return false;
        }
    },

    /**
     * Eliminar datos de localStorage
     */
    remove(key) {
        localStorage.removeItem(key);
    },

    /**
     * Limpiar todos los datos de la app
     */
    clearAll() {
        Object.values(this.KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        API.logout();
    },

    // ========== MEDICAMENTOS (ahora usa API) ==========
    async getMedicamentos() {
        try {
            return await API.getMedicamentos();
        } catch (error) {
            console.error('Error al obtener medicamentos:', error);
            return [];
        }
    },

    async addMedicamento(medicamento) {
        try {
            return await API.createMedicamento(medicamento);
        } catch (error) {
            console.error('Error al crear medicamento:', error);
            alert('Error al guardar medicamento: ' + error.message);
            throw error;
        }
    },

    async updateMedicamento(id, updates) {
        try {
            return await API.updateMedicamento(id, updates);
        } catch (error) {
            console.error('Error al actualizar medicamento:', error);
            alert('Error al actualizar medicamento: ' + error.message);
            throw error;
        }
    },

    async deleteMedicamento(id) {
        try {
            return await API.deleteMedicamento(id);
        } catch (error) {
            console.error('Error al eliminar medicamento:', error);
            alert('Error al eliminar medicamento: ' + error.message);
            throw error;
        }
    },

    // ========== HISTORIAL DE MEDICAMENTOS ==========
    getHistorialMedicamentos() {
        return this.get(this.KEYS.HISTORIAL_MEDICAMENTOS) || [];
    },

    addHistorialMedicamento(registro) {
        const historial = this.getHistorialMedicamentos();
        registro.id = this.generateId();
        registro.fecha = new Date().toISOString();
        historial.push(registro);
        // Mantener solo los últimos 1000 registros para no saturar el storage
        if (historial.length > 1000) {
            historial.shift();
        }
        this.set(this.KEYS.HISTORIAL_MEDICAMENTOS, historial);
        return registro;
    },

    // ========== CITAS ==========
    getCitas() {
        return this.get(this.KEYS.CITAS) || [];
    },

    saveCitas(citas) {
        return this.set(this.KEYS.CITAS, citas);
    },

    addCita(cita) {
        const citas = this.getCitas();
        cita.id = this.generateId();
        cita.createdAt = new Date().toISOString();
        citas.push(cita);
        this.saveCitas(citas);
        return cita;
    },

    updateCita(id, updates) {
        const citas = this.getCitas();
        const index = citas.findIndex(c => c.id === id);
        if (index !== -1) {
            citas[index] = { ...citas[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveCitas(citas);
            return citas[index];
        }
        return null;
    },

    deleteCita(id) {
        const citas = this.getCitas();
        const filtered = citas.filter(c => c.id !== id);
        this.saveCitas(filtered);
    },

    // ========== SÍNTOMAS ==========
    getSintomas() {
        return this.get(this.KEYS.SINTOMAS) || [];
    },

    saveSintomas(sintomas) {
        return this.set(this.KEYS.SINTOMAS, sintomas);
    },

    addSintoma(sintoma) {
        const sintomas = this.getSintomas();
        sintoma.id = this.generateId();
        sintomas.push(sintoma);
        // Mantener solo los últimos 500 registros
        if (sintomas.length > 500) {
            sintomas.shift();
        }
        this.saveSintomas(sintomas);
        return sintoma;
    },

    deleteSintoma(id) {
        const sintomas = this.getSintomas();
        const filtered = sintomas.filter(s => s.id !== id);
        this.saveSintomas(filtered);
    },

    // ========== SIGNOS VITALES ==========
    getSignosVitales() {
        return this.get(this.KEYS.SIGNOS_VITALES) || [];
    },

    saveSignosVitales(signos) {
        return this.set(this.KEYS.SIGNOS_VITALES, signos);
    },

    addSignoVital(signo) {
        const signos = this.getSignosVitales();
        signo.id = this.generateId();
        signos.push(signo);
        // Mantener solo los últimos 500 registros
        if (signos.length > 500) {
            signos.shift();
        }
        this.saveSignosVitales(signos);
        return signo;
    },

    deleteSignoVital(id) {
        const signos = this.getSignosVitales();
        const filtered = signos.filter(s => s.id !== id);
        this.saveSignosVitales(filtered);
    },

    // ========== TAREAS ==========
    getTareas() {
        return this.get(this.KEYS.TAREAS) || [];
    },

    saveTareas(tareas) {
        return this.set(this.KEYS.TAREAS, tareas);
    },

    addTarea(tarea) {
        const tareas = this.getTareas();
        tarea.id = this.generateId();
        tarea.createdAt = new Date().toISOString();
        tarea.completada = false;
        tareas.push(tarea);
        this.saveTareas(tareas);
        return tarea;
    },

    updateTarea(id, updates) {
        const tareas = this.getTareas();
        const index = tareas.findIndex(t => t.id === id);
        if (index !== -1) {
            tareas[index] = { ...tareas[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveTareas(tareas);
            return tareas[index];
        }
        return null;
    },

    deleteTarea(id) {
        const tareas = this.getTareas();
        const filtered = tareas.filter(t => t.id !== id);
        this.saveTareas(filtered);
    },

    // ========== CONTACTOS ==========
    getContactos() {
        return this.get(this.KEYS.CONTACTOS) || [];
    },

    saveContactos(contactos) {
        return this.set(this.KEYS.CONTACTOS, contactos);
    },

    addContacto(contacto) {
        const contactos = this.getContactos();
        contacto.id = this.generateId();
        contacto.createdAt = new Date().toISOString();
        contactos.push(contacto);
        this.saveContactos(contactos);
        return contacto;
    },

    updateContacto(id, updates) {
        const contactos = this.getContactos();
        const index = contactos.findIndex(c => c.id === id);
        if (index !== -1) {
            contactos[index] = { ...contactos[index], ...updates, updatedAt: new Date().toISOString() };
            this.saveContactos(contactos);
            return contactos[index];
        }
        return null;
    },

    deleteContacto(id) {
        const contactos = this.getContactos();
        const filtered = contactos.filter(c => c.id !== id);
        this.saveContactos(filtered);
    },

    // ========== PREMIUM STATUS ==========
    isPremium() {
        const premiumData = this.get(this.KEYS.PREMIUM_STATUS);
        if (!premiumData) return false;
        
        // Verificar que el estado premium sea válido
        return premiumData.active === true && premiumData.purchaseDate;
    },

    setPremium(paymentData) {
        const premiumData = {
            active: true,
            purchaseDate: new Date().toISOString(),
            paymentMethod: paymentData.method,
            transactionId: paymentData.transactionId,
            amount: paymentData.amount,
            currency: paymentData.currency
        };
        return this.set(this.KEYS.PREMIUM_STATUS, premiumData);
    },

    // ========== SETTINGS ==========
    getSettings() {
        return this.get(this.KEYS.SETTINGS) || {
            notifications: true,
            theme: 'light',
            language: 'es'
        };
    },

    updateSettings(settings) {
        const currentSettings = this.getSettings();
        const newSettings = { ...currentSettings, ...settings };
        return this.set(this.KEYS.SETTINGS, newSettings);
    },

    // ========== UTILIDADES ==========
    
    /**
     * Generar ID único
     * @returns {string} - ID único basado en timestamp y random
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Exportar todos los datos como JSON
     * @returns {Object} - Objeto con todos los datos
     */
    exportAllData() {
        return {
            version: '1.0.0',
            exportDate: new Date().toISOString(),
            medicamentos: this.getMedicamentos(),
            historialMedicamentos: this.getHistorialMedicamentos(),
            citas: this.getCitas(),
            sintomas: this.getSintomas(),
            signosVitales: this.getSignosVitales(),
            tareas: this.getTareas(),
            contactos: this.getContactos(),
            settings: this.getSettings()
        };
    },

    /**
     * Importar datos desde objeto JSON
     * @param {Object} data - Datos a importar
     * @returns {boolean} - True si se importó correctamente
     */
    importAllData(data) {
        try {
            if (data.medicamentos) this.saveMedicamentos(data.medicamentos);
            if (data.historialMedicamentos) this.set(this.KEYS.HISTORIAL_MEDICAMENTOS, data.historialMedicamentos);
            if (data.citas) this.saveCitas(data.citas);
            if (data.sintomas) this.saveSintomas(data.sintomas);
            if (data.signosVitales) this.saveSignosVitales(data.signosVitales);
            if (data.tareas) this.saveTareas(data.tareas);
            if (data.contactos) this.saveContactos(data.contactos);
            if (data.settings) this.updateSettings(data.settings);
            return true;
        } catch (error) {
            console.error('Error al importar datos:', error);
            return false;
        }
    },

    /**
     * Obtener estadísticas de uso
     * @returns {Object} - Estadísticas
     */
    getStats() {
        return {
            medicamentos: this.getMedicamentos().length,
            citas: this.getCitas().length,
            sintomas: this.getSintomas().length,
            signosVitales: this.getSignosVitales().length,
            tareas: this.getTareas().length,
            contactos: this.getContactos().length,
            historialMedicamentos: this.getHistorialMedicamentos().length
        };
    },

    /**
     * Verificar límites de versión gratuita
     * @returns {Object} - Estado de límites
     */
    checkLimits() {
        const isPremium = this.isPremium();
        const stats = this.getStats();
        
        return {
            medicamentos: {
                count: stats.medicamentos,
                limit: isPremium ? Infinity : 3,
                exceeded: !isPremium && stats.medicamentos >= 3
            },
            tareas: {
                count: this.getTareas().filter(t => !t.completada).length,
                limit: isPremium ? Infinity : 3,
                exceeded: !isPremium && this.getTareas().filter(t => !t.completada).length >= 3
            },
            contactos: {
                count: stats.contactos,
                limit: isPremium ? Infinity : 3,
                exceeded: !isPremium && stats.contactos >= 3
            },
            premium: isPremium
        };
    }
};

// Exponer globalmente
window.Storage = Storage;
