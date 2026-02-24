/**
 * payments.js - Sistema de pagos para CuidaDiario Premium
 * by EDEN SoftWork
 * 
 * Integración con MercadoPago, PayPal y Stripe
 */

const Payments = {
    // Configuración de pagos (IMPORTANTE: En producción, estas claves deben estar en el servidor)
    config: {
        mercadopago: {
            publicKey: 'APP_USR-64e5463f-7f48-4e3d-bca4-b091f942ea41',
            preferenceId: null
        },
        paypal: {
            clientId: 'AWwVGYftSyo3LPqMk5W5bArcczV12irsYNF0ckLztk-tAm5lJkyFyr83LtWx9uPinefZNQ1MflRt3GMD',
            planId: 'YOUR-PLAN-ID'
        },
        stripe: {
            publicKey: 'pk_test_YOUR-STRIPE-PUBLIC-KEY', // Reemplazar con tu Public Key de Stripe
            priceId: 'price_YOUR-PRICE-ID'
        }
    },

    prices: {
        ARS: 4000,
        USD: 3
    },

    /**
     * Procesar pago según el método seleccionado
     * @param {string} method - 'mercadopago', 'paypal' o 'stripe'
     * @param {string} currency - 'ARS' o 'USD'
     * @param {number} amount - Monto del pago
     */
    async procesarPago(method, currency, amount) {
        // Verificar si ya es premium
        if (Storage.getPremiumStatus()) {
            alert('¡Ya eres usuario Premium! Disfruta de todas las funcionalidades.');
            return;
        }

        switch (method) {
            case 'mercadopago':
                this.initMercadoPago(currency, amount);
                break;
            case 'paypal':
                this.initPayPal(currency, amount);
                break;
            case 'stripe':
                this.initStripe(currency, amount);
                break;
            default:
                console.error('Método de pago no válido');
        }
    },

    /**
     * Inicializar pago con MercadoPago — flujo real de suscripción mensual
     */
    async initMercadoPago(currency, amount) {
        // Verificar sesión activa
        const token = API.getToken();
        if (!token) {
            if (typeof showToast === 'function') showToast('Debes iniciar sesión para suscribirte.', 'error');
            else alert('Debes iniciar sesión para suscribirte.');
            return;
        }

        // Cerrar modal y mostrar feedback
        if (typeof closePremiumModal === 'function') closePremiumModal();
        if (typeof showToast === 'function') showToast('Conectando con MercadoPago...', 'info', 4000);

        // Deshabilitar botón si existe
        const btn = document.querySelector('[onclick*="mercadopago"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }

        try {
            const response = await fetch(`${API.BASE_URL}/api/create-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                const msg = data.error || 'Error al iniciar el pago. Intentá nuevamente.';
                if (typeof showToast === 'function') showToast(msg, 'error');
                else alert(msg);
                if (btn) { btn.disabled = false; btn.textContent = 'Suscribirme con MercadoPago'; }
                return;
            }

            // Redirigir al checkout de MercadoPago
            window.location.href = data.init_point;

        } catch (error) {
            console.error('Error en MercadoPago:', error);
            const msg = 'Error de conexión. Revisá tu internet e intentá nuevamente.';
            if (typeof showToast === 'function') showToast(msg, 'error');
            else alert(msg);
            if (btn) { btn.disabled = false; btn.textContent = 'Suscribirme con MercadoPago'; }
        }
    },

    /**
     * Inicializar pago con PayPal
     */
    async initPayPal(currency, amount) {
        try {
            const token = API.getToken();
            if (!token) {
                if (typeof showToast === 'function') showToast('Debes iniciar sesión para suscribirte.', 'error');
                else alert('Debes iniciar sesión para suscribirte.');
                return;
            }

            // Cerrar modal premium si está abierto
            if (typeof closePremiumModal === 'function') closePremiumModal();

            // Mostrar feedback de carga
            if (typeof showToast === 'function') showToast('Cargando PayPal...', 'info', 3000);

            // Cargar SDK de PayPal si no está cargado aún
            if (!window.paypal) {
                await this.loadPayPalSDK(currency);
            }

            // Eliminar modal anterior si existe
            const existingModal = document.getElementById('paypal-modal');
            if (existingModal) existingModal.remove();

            // Crear modal con contenedor para el botón PayPal
            const modal = document.createElement('div');
            modal.id = 'paypal-modal';
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 450px; padding: 30px; text-align: center;">
                    <h3 style="margin-bottom: 10px;">💳 Pago con PayPal</h3>
                    <p style="color: #666; margin-bottom: 5px;">Plan Premium — CuidaDiario</p>
                    <p style="font-size: 1.3rem; font-weight: 700; margin-bottom: 20px;">$${amount} ${currency}/mes</p>
                    <div id="paypal-button-container" style="min-height: 45px;"></div>
                    <button onclick="document.getElementById('paypal-modal').remove()" style="margin-top: 20px; background: none; border: none; color: #999; cursor: pointer; font-size: 0.9rem; text-decoration: underline;">Cancelar</button>
                </div>
            `;
            document.body.appendChild(modal);

            // Renderizar botones de PayPal
            paypal.Buttons({
                style: {
                    layout: 'vertical',
                    color: 'blue',
                    shape: 'rect',
                    label: 'paypal'
                },
                // createOrder llama al backend para crear la orden de forma segura
                createOrder: async () => {
                    const response = await fetch(`${API.BASE_URL}/api/paypal/create-order`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ amount: String(amount), currency })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Error al crear orden PayPal');
                    return data.orderID;
                },
                // onApprove llama al backend para capturar el pago y activar premium
                onApprove: async (data) => {
                    if (typeof showToast === 'function') showToast('Procesando pago...', 'info', 3000);
                    const response = await fetch(`${API.BASE_URL}/api/paypal/capture-order/${data.orderID}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Error al capturar pago PayPal');

                    document.getElementById('paypal-modal')?.remove();
                    this.handleSuccessfulPayment({
                        method: 'paypal',
                        transactionId: data.orderID,
                        amount: amount,
                        currency: currency
                    });
                },
                onError: (err) => {
                    console.error('Error en PayPal:', err);
                    if (typeof showToast === 'function') showToast('Error al procesar el pago con PayPal', 'error');
                    else alert('Error al procesar el pago con PayPal');
                },
                onCancel: () => {
                    if (typeof showToast === 'function') showToast('Pago cancelado', 'info');
                }
            }).render('#paypal-button-container');

        } catch (error) {
            console.error('Error en PayPal:', error);
            if (typeof showToast === 'function') showToast('Error al cargar PayPal. Por favor, intenta nuevamente.', 'error');
            else alert('Error al procesar el pago. Por favor, intenta nuevamente.');
        }
    },

    /**
     * Inicializar pago con Stripe
     */
    async initStripe(currency, amount) {
        try {
            alert(`MODO DESARROLLO: Stripe\n\nPara integrar Stripe en producción:\n\n1. Crear cuenta en stripe.com\n2. Obtener API Keys (Publishable y Secret)\n3. Usar Stripe Checkout o Elements\n4. Procesar pago desde backend\n\nPrecio: $${amount} ${currency}`);

            // Simular pago exitoso en desarrollo
            if (confirm('¿Simular pago exitoso para testing?')) {
                this.handleSuccessfulPayment({
                    method: 'stripe',
                    transactionId: `STRIPE-${Date.now()}`,
                    amount: amount,
                    currency: currency
                });
            }

            /* CÓDIGO PARA PRODUCCIÓN (requiere backend):
            
            // 1. Cargar Stripe.js
            if (!window.Stripe) {
                await this.loadStripeSDK();
            }
            
            const stripe = Stripe(this.config.stripe.publicKey);
            
            // 2. Crear sesión de pago en tu backend
            const response = await fetch('YOUR_BACKEND_URL/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: this.config.stripe.priceId,
                    successUrl: window.location.origin + '/success',
                    cancelUrl: window.location.origin + '/cancel'
                })
            });
            
            const { sessionId } = await response.json();
            
            // 3. Redirigir a Stripe Checkout
            const { error } = await stripe.redirectToCheckout({ sessionId });
            
            if (error) {
                console.error('Error en Stripe:', error);
                alert('Error al procesar el pago con Stripe');
            }
            
            */

        } catch (error) {
            console.error('Error en Stripe:', error);
            alert('Error al procesar el pago. Por favor, intenta nuevamente.');
        }
    },

    /**
     * Manejar pago exitoso
     * @param {Object} paymentData - Datos del pago
     */
    handleSuccessfulPayment(paymentData) {
        // Guardar estado premium
        Storage.setPremium(paymentData);

        // Cerrar modal de premium
        closePremiumModal();

        // Actualizar UI
        updatePremiumStatus();

        // Mostrar mensaje de éxito
        this.showSuccessMessage(paymentData);

        // Enviar confirmación al backend (en producción)
        // this.sendPaymentConfirmation(paymentData);
    },

    /**
     * Mostrar mensaje de éxito
     */
    showSuccessMessage(paymentData) {
        const message = `
            <div style="text-align: center; padding: 30px;">
                <h2 style="color: #4CAF50; margin-bottom: 20px;">¡Pago Exitoso! 🎉</h2>
                <p style="font-size: 1.2rem; margin-bottom: 15px;">Bienvenido a <strong>CuidaDiario Premium</strong></p>
                <p>Ya puedes disfrutar de todas las funcionalidades sin límites.</p>
                <p style="margin-top: 20px; color: #757575; font-size: 0.9rem;">ID de transacción: ${paymentData.transactionId}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: #4CAF50; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                    Comenzar a usar Premium
                </button>
            </div>
        `;

        // Crear modal de éxito
        const successModal = document.createElement('div');
        successModal.className = 'modal active';
        successModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                ${message}
            </div>
        `;

        document.body.appendChild(successModal);

        // Recargar después de 5 segundos si no hace clic
        setTimeout(() => {
            location.reload();
        }, 5000);
    },

    /**
     * Verificar pago desde URL (para redirecciones de pasarelas)
     * Útil para PayPal y Stripe que redirigen de vuelta a la app
     */
    checkPaymentFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // MercadoPago
        const mpStatus = urlParams.get('status');
        const mpPaymentId = urlParams.get('payment_id');
        
        if (mpStatus && mpPaymentId) {
            if (mpStatus === 'approved') {
                this.handleSuccessfulPayment({
                    method: 'mercadopago',
                    transactionId: mpPaymentId,
                    amount: this.prices.ARS,
                    currency: 'ARS'
                });
            } else {
                alert('El pago no fue aprobado. Por favor, intenta nuevamente.');
            }
            
            // Limpiar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // PayPal
        const ppToken = urlParams.get('token');
        const ppPayerId = urlParams.get('PayerID');
        
        if (ppToken && ppPayerId) {
            // En producción, verificar con el backend
            this.handleSuccessfulPayment({
                method: 'paypal',
                transactionId: ppToken,
                amount: this.prices.USD,
                currency: 'USD'
            });
            
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Stripe
        const stripeSuccess = urlParams.get('stripe_success');
        const stripeSessionId = urlParams.get('session_id');
        
        if (stripeSuccess === 'true' && stripeSessionId) {
            this.handleSuccessfulPayment({
                method: 'stripe',
                transactionId: stripeSessionId,
                amount: this.prices.USD,
                currency: 'USD'
            });
            
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    },

    /**
     * Cargar SDK de PayPal dinámicamente
     */
    loadPayPalSDK(currency = 'USD') {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${this.config.paypal.clientId}&currency=${currency}`;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Cargar SDK de Stripe dinámicamente
     */
    loadStripeSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    /**
     * Enviar confirmación de pago al backend (para producción)
     * @param {Object} paymentData
     */
    async sendPaymentConfirmation(paymentData) {
        try {
            /* En producción, descomentar y ajustar:
            
            await fetch('YOUR_BACKEND_URL/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_AUTH_TOKEN'
                },
                body: JSON.stringify(paymentData)
            });
            
            */
            console.log('Pago confirmado:', paymentData);
        } catch (error) {
            console.error('Error al enviar confirmación:', error);
        }
    }
};

// Verificar pagos al cargar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Payments.checkPaymentFromURL());
} else {
    Payments.checkPaymentFromURL();
}

// Exponer función global para usar desde HTML
window.procesarPago = (method, currency, amount) => {
    Payments.procesarPago(method, currency, amount);
};

window.Payments = Payments;

