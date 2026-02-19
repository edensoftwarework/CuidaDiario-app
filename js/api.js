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
        window.location.href = '#login';
    },
    
    // ==================== MEDICAMENTOS ====================
    
    async getMedicamentos() {
        const response = await fetch(`${this.BASE_URL}/api/medicamentos`, {
            headers: this.getHeaders()
        });
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
    
    async getCitas() {
        const response = await fetch(`${this.BASE_URL}/api/citas`, {
            headers: this.getHeaders()
        });
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
    
    async getTareas() {
        const response = await fetch(`${this.BASE_URL}/api/tareas`, {
            headers: this.getHeaders()
        });
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
    
    async getSintomas() {
        const response = await fetch(`${this.BASE_URL}/api/sintomas`, {
            headers: this.getHeaders()
        });
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
    
    async getContactos() {
        const response = await fetch(`${this.BASE_URL}/api/contactos`, {
            headers: this.getHeaders()
        });
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
    }
};


