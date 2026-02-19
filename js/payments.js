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
            publicKey: 'TEST-YOUR-PUBLIC-KEY', // Reemplazar con tu Public Key de MercadoPago
            preferenceId: null
        },
        paypal: {
            clientId: 'YOUR-PAYPAL-CLIENT-ID', // Reemplazar con tu Client ID de PayPal
            planId: 'YOUR-PLAN-ID'
        },
        stripe: {
            publicKey: 'pk_test_YOUR-STRIPE-PUBLIC-KEY', // Reemplazar con tu Public Key de Stripe
            priceId: 'price_YOUR-PRICE-ID'
        }
    },

    prices: {
        ARS: 29999,
        USD: 19.99
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
     * Inicializar pago con MercadoPago
     * IMPORTANTE: En producción, la creación de preferencia debe hacerse desde el backend
     */
    async initMercadoPago(currency, amount) {
        try {
            // Mostrar mensaje de desarrollo
            alert(`MODO DESARROLLO: MercadoPago\n\nPara integrar MercadoPago en producción:\n\n1. Crear cuenta en mercadopago.com.ar\n2. Obtener credenciales (Public Key y Access Token)\n3. Crear preferencia de pago desde el backend\n4. Usar el SDK de MercadoPago\n\nPrecio: $${amount} ${currency}`);

            // Simular pago exitoso en desarrollo
            if (confirm('¿Simular pago exitoso para testing?')) {
                this.handleSuccessfulPayment({
                    method: 'mercadopago',
                    transactionId: `MP-${Date.now()}`,
                    amount: amount,
                    currency: currency
                });
            }

            /* CÓDIGO PARA PRODUCCIÓN (requiere backend):
            
            // 1. Crear preferencia en tu backend
            const response = await fetch('YOUR_BACKEND_URL/create-preference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'CuidaDiario Premium',
                    unit_price: amount,
                    quantity: 1,
                    currency_id: currency
                })
            });
            
            const { preferenceId } = await response.json();
            
            // 2. Redirigir a MercadoPago
            const mp = new MercadoPago(this.config.mercadopago.publicKey);
            mp.checkout({
                preference: { id: preferenceId },
                autoOpen: true
            });
            
            */

        } catch (error) {
            console.error('Error en MercadoPago:', error);
            alert('Error al procesar el pago. Por favor, intenta nuevamente.');
        }
    },

    /**
     * Inicializar pago con PayPal
     */
    async initPayPal(currency, amount) {
        try {
            alert(`MODO DESARROLLO: PayPal\n\nPara integrar PayPal en producción:\n\n1. Crear cuenta Business en paypal.com\n2. Obtener Client ID y Secret\n3. Usar PayPal Checkout SDK\n4. Implementar botón de PayPal\n\nPrecio: $${amount} ${currency}`);

            // Simular pago exitoso en desarrollo
            if (confirm('¿Simular pago exitoso para testing?')) {
                this.handleSuccessfulPayment({
                    method: 'paypal',
                    transactionId: `PP-${Date.now()}`,
                    amount: amount,
                    currency: currency
                });
            }

            /* CÓDIGO PARA PRODUCCIÓN:
            
            // Cargar SDK de PayPal
            if (!window.paypal) {
                await this.loadPayPalSDK();
            }
            
            // Renderizar botón de PayPal
            paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            description: 'CuidaDiario Premium',
                            amount: {
                                currency_code: currency,
                                value: amount
                            }
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then(details => {
                        this.handleSuccessfulPayment({
                            method: 'paypal',
                            transactionId: details.id,
                            amount: amount,
                            currency: currency,
                            details: details
                        });
                    });
                },
                onError: (err) => {
                    console.error('Error en PayPal:', err);
                    alert('Error al procesar el pago con PayPal');
                }
            }).render('#paypal-button-container');
            
            */

        } catch (error) {
            console.error('Error en PayPal:', error);
            alert('Error al procesar el pago. Por favor, intenta nuevamente.');
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
    loadPayPalSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${this.config.paypal.clientId}&currency=USD`;
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

