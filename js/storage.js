/**
 * storage.js - Sistema de almacenamiento para CuidaDiario
 * by EDEN SoftWork
 * 
 * Ahora usa la API del backend en lugar de localStorage para datos principales
 * Mantiene localStorage solo para configuraciones locales
 */

const Storage = {
    // Paciente actualmente seleccionado (null = todos)
    currentPacienteId: null,

    // Claves de almacenamiento local
    KEYS: {
        PREMIUM_STATUS: 'cuidadiario_premium',
        SETTINGS: 'cuidadiario_settings',
        WELCOME_SHOWN: 'cuidadiario_welcome_shown'
    },

    // Claves que dependen del usuario (evitar compartir datos entre cuentas)
    getUserKey(base) {
        const user = API.getUser();
        const uid = user ? user.id : 'guest';
        return `${base}_${uid}`;
    },

    getHistorialKey() {
        return this.getUserKey('cuidadiario_historial_medicamentos');
    },

    getSignosKey() {
        return this.getUserKey('cuidadiario_signos_vitales');
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
            return await API.getMedicamentos(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addMedicamento(medicamento) {
        try {
            if (this.currentPacienteId) medicamento = { ...medicamento, paciente_id: this.currentPacienteId };
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
            return await API.getCitas(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addCita(cita) {
        try {
            if (this.currentPacienteId) cita = { ...cita, paciente_id: this.currentPacienteId };
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
            return await API.getTareas(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addTarea(tarea) {
        try {
            if (this.currentPacienteId) tarea = { ...tarea, paciente_id: this.currentPacienteId };
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
            return await API.getSintomas(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addSintoma(sintoma) {
        try {
            if (this.currentPacienteId) sintoma = { ...sintoma, paciente_id: this.currentPacienteId };
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
            return await API.getContactos(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addContacto(contacto) {
        try {
            if (this.currentPacienteId) contacto = { ...contacto, paciente_id: this.currentPacienteId };
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
    // ========== HISTORIAL MEDICAMENTOS (API) ==========
    async getHistorialMedicamentos() {
        try {
            return await API.getHistorialMedicamentos(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addHistorialMedicamento(registro) {
        try {
            if (this.currentPacienteId) registro = { ...registro, paciente_id: this.currentPacienteId };
            return await API.createHistorialMedicamento(registro);
        } catch (error) {
            console.error('Error:', error);
        }
    },

    async deleteHistorialMedicamento(id) {
        try {
            return await API.deleteHistorialMedicamento(id);
        } catch (error) {
            console.error('Error al eliminar registro:', error);
            throw error;
        }
    },

    // ========== HISTORIAL TAREAS (API) ==========
    async getHistorialTareas() {
        try {
            return await API.getHistorialTareas(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addHistorialTarea(registro) {
        try {
            if (this.currentPacienteId) registro = { ...registro, paciente_id: this.currentPacienteId };
            return await API.createHistorialTarea(registro);
        } catch (error) {
            console.error('Error:', error);
        }
    },

    async deleteHistorialTarea(id) {
        try {
            return await API.deleteHistorialTarea(id);
        } catch (error) {
            console.error('Error al eliminar registro de tarea:', error);
            throw error;
        }
    },
    async getSignosVitales() {
        try {
            return await API.getSignosVitales(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addSignoVital(signo) {
        try {
            if (this.currentPacienteId) signo = { ...signo, paciente_id: this.currentPacienteId };
            return await API.createSignoVital(signo);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar signo vital: ' + error.message);
            throw error;
        }
    },

    async deleteSignoVital(id) {
        try {
            return await API.deleteSignoVital(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar: ' + error.message);
            throw error;
        }
    },

    // ========== PACIENTES (API) ==========
    async getPacientes() {
        try {
            return await API.getPacientes();
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addPaciente(paciente) {
        try {
            return await API.createPaciente(paciente);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar paciente: ' + error.message);
            throw error;
        }
    },

    async updatePaciente(id, updates) {
        try {
            return await API.updatePaciente(id, updates);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar paciente: ' + error.message);
            throw error;
        }
    },

    async deletePaciente(id) {
        try {
            return await API.deletePaciente(id);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al eliminar paciente: ' + error.message);
            throw error;
        }
    },

    // ========== PREMIUM ==========
    getPremiumStatus() {
        // Siempre leer desde el usuario autenticado (dato del backend, específico por cuenta)
        const user = API.getUser();
        if (user && typeof user.premium !== 'undefined') {
            return user.premium === true;
        }
        // Fallback: localStorage solo si no hay usuario cargado (no debería ocurrir)
        return false;
    },

    setPremiumStatus(status) {
        // Actualizar también el objeto de usuario en localStorage para coherencia
        const user = API.getUser();
        if (user) {
            user.premium = status;
            API.setUser(user);
        }
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
            medicamentos: 6,
            citas: 3,
            tareas: 3,
            contactos: 2,
            notas: 6
        };

        return current < (limits[type] || Infinity);
    },

    // Verificar límites de uso
    async checkLimits() {
        const isPremium = this.getPremiumStatus();
        
        if (isPremium) {
            return {
                premium: true,
                medicamentos: { current: 999, max: 999, exceeded: false, locked: 0 },
                citas: { current: 999, max: 999, exceeded: false, locked: 0 },
                tareas: { current: 999, max: 999, exceeded: false, locked: 0 },
                contactos: { current: 999, max: 999, exceeded: false, locked: 0 }
            };
        }

        const [medicamentos, citas, tareas, contactos, notas] = await Promise.all([
            this.getMedicamentos(),
            this.getCitas(),
            this.getTareas(),
            this.getContactos(),
            this.getNotas()
        ]);

        const FREE = { medicamentos: 6, citas: 3, tareas: 3, contactos: 2, notas: 6 };

        return {
            premium: false,
            medicamentos: {
                current: medicamentos.length,
                max: FREE.medicamentos,
                exceeded: medicamentos.length >= FREE.medicamentos,
                locked: Math.max(0, medicamentos.length - FREE.medicamentos)
            },
            citas: {
                current: citas.length,
                max: FREE.citas,
                exceeded: citas.length >= FREE.citas,
                locked: Math.max(0, citas.length - FREE.citas)
            },
            tareas: {
                current: tareas.length,
                max: FREE.tareas,
                exceeded: tareas.length >= FREE.tareas,
                locked: Math.max(0, tareas.length - FREE.tareas)
            },
            contactos: {
                current: contactos.length,
                max: FREE.contactos,
                exceeded: contactos.length >= FREE.contactos,
                locked: Math.max(0, contactos.length - FREE.contactos)
            },
            notas: {
                current: notas.length,
                max: FREE.notas,
                exceeded: notas.length >= FREE.notas,
                locked: 0
            }
        };
    },

    // ========== NOTAS ==========
    async getNotas() {
        try {
            return await API.getNotas(this.currentPacienteId);
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    },

    async addNota(nota) {
        try {
            if (this.currentPacienteId) nota = { ...nota, paciente_id: this.currentPacienteId };
            return await API.createNota(nota);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar nota: ' + error.message);
            throw error;
        }
    },

    async deleteNota(id) {
        try {
            return await API.deleteNota(id);
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    },

    async updateNota(id, data) {
        try {
            return await API.updateNota(id, data);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al actualizar nota: ' + error.message);
            throw error;
        }
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
                historial: await this.getHistorialMedicamentos(),
                signos: await this.getSignosVitales(),
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error al exportar:', error);
            throw error;
        }
    }
};
