/**
 * api.js - Cliente API para CuidaDiario
 * by EDEN SoftWork
 * 
 * Maneja todas las comunicaciones con el backend
 */

const API = {
    // URL base del backend (cambia esto por tu URL de Railway)
    // IMPORTANTE: SIN /api al final, los endpoints ya incluyen /api
    BASE_URL: 'https://cuidadiario-backend-production.up.railway.app',
    
    // Obtener token guardado
    getToken() {
        return localStorage.getItem('cuidadiario_token');
    },
    
    // Guardar token
    setToken(token) {
        localStorage.setItem('cuidadiario_token', token);
    },
    
    // Eliminar token
    removeToken() {
        localStorage.removeItem('cuidadiario_token');
        localStorage.removeItem('cuidadiario_user');
    },
    
    // Obtener usuario guardado
    getUser() {
        const user = localStorage.getItem('cuidadiario_user');
        return user ? JSON.parse(user) : null;
    },
    
    // Guardar usuario
    setUser(user) {
        localStorage.setItem('cuidadiario_user', JSON.stringify(user));
    },
    
    // Verificar si está autenticado
    isAuthenticated() {
        return !!this.getToken();
    },
    
    // Headers con autenticación
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (includeAuth) {
            const token = this.getToken();
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }
        
        return headers;
    },
    
    // Manejo de errores
    async handleResponse(response) {
        if (response.status === 401) {
            // Token inválido o expirado
            this.removeToken();
            window.location.href = '#login';
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error en la petición');
        }
        
        return response.json();
    },
    
    // ==================== AUTENTICACIÓN ====================
    
    async register(nombre, email, password) {
        const response = await fetch(`${this.BASE_URL}/api/register`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ nombre, email, password })
        });
        return this.handleResponse(response);
    },
    
    async login(email, password) {
        const response = await fetch(`${this.BASE_URL}/api/login`, {
            method: 'POST',
            headers: this.getHeaders(false),
            body: JSON.stringify({ email, password })
        });
        const data = await this.handleResponse(response);
        
        // Guardar token y usuario
        this.setToken(data.token);
        this.setUser(data.usuario);
        
        return data;
    },
    
    logout() {
        this.removeToken();
        window.location.href = 'login.html';
    },

    // Recargar datos del usuario desde el backend y actualizar localStorage
    async refreshUser() {
        try {
            const response = await fetch(`${this.BASE_URL}/api/me`, {
                headers: this.getHeaders(),
                cache: 'no-store'
            });
            if (!response.ok) return null;
            const data = await response.json();
            if (data.usuario) {
                this.setUser(data.usuario);
                return data.usuario;
            }
            return null;
        } catch (err) {
            console.warn('No se pudo recargar el usuario:', err);
            return null;
        }
    },
    
    // ==================== MEDICAMENTOS ====================
    
    async getMedicamentos(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/medicamentos?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/medicamentos`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },
    
    async getMedicamento(id) {
        const response = await fetch(`${this.BASE_URL}/api/medicamentos/${id}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    async createMedicamento(data) {
        const response = await fetch(`${this.BASE_URL}/api/medicamentos`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async updateMedicamento(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/medicamentos/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async deleteMedicamento(id) {
        const response = await fetch(`${this.BASE_URL}/api/medicamentos/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    // ==================== CITAS ====================
    
    async getCitas(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/citas?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/citas`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },
    
    async getCita(id) {
        const response = await fetch(`${this.BASE_URL}/api/citas/${id}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    async createCita(data) {
        const response = await fetch(`${this.BASE_URL}/api/citas`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async updateCita(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/citas/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async deleteCita(id) {
        const response = await fetch(`${this.BASE_URL}/api/citas/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    // ==================== TAREAS ====================
    
    async getTareas(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/tareas?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/tareas`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },
    
    async getTarea(id) {
        const response = await fetch(`${this.BASE_URL}/api/tareas/${id}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    async createTarea(data) {
        const response = await fetch(`${this.BASE_URL}/api/tareas`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async updateTarea(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/tareas/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async deleteTarea(id) {
        const response = await fetch(`${this.BASE_URL}/api/tareas/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    // ==================== SÍNTOMAS ====================
    
    async getSintomas(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/sintomas?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/sintomas`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },
    
    async getSintoma(id) {
        const response = await fetch(`${this.BASE_URL}/api/sintomas/${id}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    async createSintoma(data) {
        const response = await fetch(`${this.BASE_URL}/api/sintomas`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async updateSintoma(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/sintomas/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async deleteSintoma(id) {
        const response = await fetch(`${this.BASE_URL}/api/sintomas/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    // ==================== CONTACTOS ====================
    
    async getContactos(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/contactos?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/contactos`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },
    
    async getContacto(id) {
        const response = await fetch(`${this.BASE_URL}/api/contactos/${id}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },
    
    async createContacto(data) {
        const response = await fetch(`${this.BASE_URL}/api/contactos`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async updateContacto(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/contactos/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },
    
    async deleteContacto(id) {
        const response = await fetch(`${this.BASE_URL}/api/contactos/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // ==================== SIGNOS VITALES ====================

    async getSignosVitales(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/signos-vitales?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/signos-vitales`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },

    async createSignoVital(data) {
        const response = await fetch(`${this.BASE_URL}/api/signos-vitales`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    async deleteSignoVital(id) {
        const response = await fetch(`${this.BASE_URL}/api/signos-vitales/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // ==================== HISTORIAL MEDICAMENTOS ====================

    async getHistorialMedicamentos(paciente_id = null) {
        const url = paciente_id
            ? `${this.BASE_URL}/api/historial-medicamentos?paciente_id=${paciente_id}`
            : `${this.BASE_URL}/api/historial-medicamentos`;
        const response = await fetch(url, { headers: this.getHeaders() });
        return this.handleResponse(response);
    },

    async createHistorialMedicamento(data) {
        const response = await fetch(`${this.BASE_URL}/api/historial-medicamentos`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    async deleteHistorialMedicamento(id) {
        const response = await fetch(`${this.BASE_URL}/api/historial-medicamentos/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // ==================== PACIENTES ====================

    async getPacientes() {
        const response = await fetch(`${this.BASE_URL}/api/pacientes`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    async createPaciente(data) {
        const response = await fetch(`${this.BASE_URL}/api/pacientes`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    async updatePaciente(id, data) {
        const response = await fetch(`${this.BASE_URL}/api/pacientes/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    async deletePaciente(id) {
        const response = await fetch(`${this.BASE_URL}/api/pacientes/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // ==================== PERFIL ====================

    async updateProfile(data) {
        const response = await fetch(`${this.BASE_URL}/api/profile`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        return this.handleResponse(response);
    },

    // ==================== PUSH NOTIFICATIONS ====================

    async getPushVapidKey() {
        const response = await fetch(`${this.BASE_URL}/api/push/vapid-key`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    async savePushSubscription(subscription) {
        const response = await fetch(`${this.BASE_URL}/api/push/subscribe`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(subscription)
        });
        return this.handleResponse(response);
    },

    async deletePushSubscription(endpoint) {
        const response = await fetch(`${this.BASE_URL}/api/push/unsubscribe`, {
            method: 'DELETE',
            headers: this.getHeaders(),
            body: JSON.stringify({ endpoint })
        });
        return this.handleResponse(response);
    },

    // Envía una push de prueba al usuario para verificar que el sistema funciona end-to-end
    async testPush() {
        const response = await fetch(`${this.BASE_URL}/api/push/test`, {
            method: 'POST',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // Verifica cuántas suscripciones push tiene el usuario en el backend
    async getPushStatus() {
        const response = await fetch(`${this.BASE_URL}/api/push/status`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    // ========== CO-CUIDADOR: ACCESO COMPARTIDO (PREMIUM) ==========

    /**
     * Invita a otro usuario (por email) a ser co-cuidador de un paciente.
     * @param {number} pacienteId
     * @param {string} email
     */
    async inviteShare(pacienteId, email) {
        const response = await fetch(`${this.BASE_URL}/api/share/${pacienteId}/invite`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ email })
        });
        return this.handleResponse(response);
    },

    /**
     * Acepta una invitación de co-cuidador usando el token recibido por email.
     * @param {string} token
     */
    async acceptShare(token) {
        const response = await fetch(`${this.BASE_URL}/api/share/accept?token=${encodeURIComponent(token)}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Lista los co-cuidadores de un paciente (solo el dueño puede listarlos).
     * @param {number} pacienteId
     */
    async listShares(pacienteId) {
        const response = await fetch(`${this.BASE_URL}/api/share/list/${pacienteId}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    },

    /**
     * Revoca el acceso de un co-cuidador.
     * @param {number} shareId - id de la fila en paciente_compartidos
     */
    async deleteShare(shareId) {
        const response = await fetch(`${this.BASE_URL}/api/share/${shareId}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        return this.handleResponse(response);
    }
};



