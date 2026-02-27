/**
 * i18n.js — Sistema de internacionalización (ES / EN)
 * by EDEN SoftWork
 *
 * Uso:
 *   t('key')              → traducción en idioma actual
 *   I18n.setLanguage('en') → cambiar idioma y re-aplicar
 *   I18n.apply()          → aplicar traducciones al DOM
 *
 * En HTML: <element data-i18n="key">texto fallback</element>
 *          <input   data-i18n="key" data-i18n-attr="placeholder">
 */

const I18N_TRANSLATIONS = {
    es: {
        /* ── Navegación ── */
        'nav.dashboard':    'Inicio',
        'nav.medicamentos': 'Medicamentos',
        'nav.citas':        'Citas',
        'nav.sintomas':     'Síntomas',
        'nav.tareas':       'Tareas',
        'nav.contactos':    'Contactos',
        'nav.reportes':     'Reportes',
        'nav.nosotros':     'Nosotros',

        /* ── Idioma ── */
        'lang.toggle': '🇬🇧 English',

        /* ── Perfil ── */
        'profile.title':           '👤 Mi Perfil',
        'profile.name':            'Nombre',
        'profile.email':           'Email',
        'profile.pwd.section':     '🔒 Cambiar contraseña (dejá en blanco si no querés cambiarla)',
        'profile.pwd.new':         'Nueva contraseña',
        'profile.pwd.confirm':     'Confirmar nueva contraseña',
        'profile.timezone':        'Zona horaria',
        'profile.save':            'Guardar cambios',
        'profile.push.title':      '🔔 Notificaciones push',
        'profile.push.desc':       'Recordatorios automáticos aunque la app esté cerrada. Se activan solos al iniciar sesión.',
        'profile.push.btn.on':     '🔔 Notificaciones activadas — Desactivar',
        'profile.push.btn.off':    '🔔 Activar notificaciones push',
        'profile.push.btn.denied': '🔕 Permiso denegado en el navegador',
        'profile.install.title':   '📲 Instalar app en tu celular',
        'profile.install.desc':    'Instalá CuidaDiario como app para acceso rápido y notificaciones más confiables, incluso con el navegador cerrado.',
        'profile.install.btn':     '📲 Agregar a pantalla de inicio',
        'profile.install.done':    '✅ App ya instalada',

        /* ── Acciones comunes ── */
        'btn.save':   'Guardar',
        'btn.cancel': 'Cancelar',
        'btn.delete': 'Eliminar',
        'btn.edit':   'Editar',
        'btn.add':    'Agregar',
        'btn.close':  'Cerrar',

        /* ── Dashboard ── */
        'dash.welcome': '¡Bienvenido/a',
        'dash.meds':    'Medicamentos activos',
        'dash.citas':   'Citas esta semana',
        'dash.tasks':   'Tareas pendientes hoy',

        /* ── Secciones ── */
        'section.medicamentos': '💊 Medicamentos',
        'section.citas':        '📅 Citas Médicas',
        'section.sintomas':     '📝 Síntomas y Estado',
        'section.tareas':       '✓ Tareas de Cuidado',
        'section.contactos':    '📞 Contactos de Salud',
        'section.reportes':     '📊 Reportes',

        /* ── Onboarding ── */
        'onb.1.title': '¡Bienvenido/a a CuidaDiario!',
        'onb.1.body':  'La app que te ayuda a organizar el cuidado de tus seres queridos. Te mostramos las funciones principales en 3 pasos rápidos.',
        'onb.1.btn':   'Empezar →',
        'onb.2.title': '💊 Medicamentos y recordatorios',
        'onb.2.body':  'Registrá los medicamentos con su frecuencia y hora de inicio. Activá el recordatorio y te avisaremos en tu celular — incluso con la app cerrada.',
        'onb.2.btn':   'Siguiente →',
        'onb.3.title': '📅 Citas y tareas',
        'onb.3.body':  'Agendá citas médicas y tareas de cuidado. Podés configurar cuánto tiempo antes querés que te avisemos para cada una.',
        'onb.3.btn':   'Siguiente →',
        'onb.4.title': '🌟 ¡Todo listo!',
        'onb.4.body':  '¡Podés empezar! Si tenés dudas escribinos a edensoftwarework@gmail.com — siempre estamos.',
        'onb.4.btn':   '¡Comenzar!',
        'onb.skip':    'Saltar introducción',

        /* ── Exportar ── */
        'export.json': '📥 Exportar JSON (backup)',
        'export.csv':  '📊 Exportar CSV (Excel)',
    },

    en: {
        /* ── Navigation ── */
        'nav.dashboard':    'Home',
        'nav.medicamentos': 'Medications',
        'nav.citas':        'Appointments',
        'nav.sintomas':     'Symptoms',
        'nav.tareas':       'Tasks',
        'nav.contactos':    'Contacts',
        'nav.reportes':     'Reports',
        'nav.nosotros':     'About',

        /* ── Language ── */
        'lang.toggle': '🇦🇷 Español',

        /* ── Profile ── */
        'profile.title':           '👤 My Profile',
        'profile.name':            'Name',
        'profile.email':           'Email',
        'profile.pwd.section':     '🔒 Change password (leave blank to keep current)',
        'profile.pwd.new':         'New password',
        'profile.pwd.confirm':     'Confirm new password',
        'profile.timezone':        'Timezone',
        'profile.save':            'Save changes',
        'profile.push.title':      '🔔 Push notifications',
        'profile.push.desc':       'Automatic reminders even when the app is closed. They activate automatically when you log in.',
        'profile.push.btn.on':     '🔔 Notifications active — Disable',
        'profile.push.btn.off':    '🔔 Enable push notifications',
        'profile.push.btn.denied': '🔕 Permission denied in browser',
        'profile.install.title':   '📲 Install app on your phone',
        'profile.install.desc':    'Install CuidaDiario as an app for quick access and more reliable notifications, even with the browser closed.',
        'profile.install.btn':     '📲 Add to home screen',
        'profile.install.done':    '✅ App already installed',

        /* ── Common actions ── */
        'btn.save':   'Save',
        'btn.cancel': 'Cancel',
        'btn.delete': 'Delete',
        'btn.edit':   'Edit',
        'btn.add':    'Add',
        'btn.close':  'Close',

        /* ── Dashboard ── */
        'dash.welcome': 'Welcome',
        'dash.meds':    'Active medications',
        'dash.citas':   'Appointments this week',
        'dash.tasks':   'Tasks pending today',

        /* ── Sections ── */
        'section.medicamentos': '💊 Medications',
        'section.citas':        '📅 Medical Appointments',
        'section.sintomas':     '📝 Symptoms & Mood',
        'section.tareas':       '✓ Care Tasks',
        'section.contactos':    '📞 Health Contacts',
        'section.reportes':     '📊 Reports',

        /* ── Onboarding ── */
        'onb.1.title': 'Welcome to CuidaDiario!',
        'onb.1.body':  'The app that helps you organize care for your loved ones. We\'ll show you the main features in 3 quick steps.',
        'onb.1.btn':   'Get started →',
        'onb.2.title': '💊 Medications & reminders',
        'onb.2.body':  'Register medications with their frequency and start time. Enable the reminder and we\'ll notify you on your phone — even when the app is closed.',
        'onb.2.btn':   'Next →',
        'onb.3.title': '📅 Appointments & tasks',
        'onb.3.body':  'Schedule medical appointments and care tasks. You can set how much advance notice you want for each one.',
        'onb.3.btn':   'Next →',
        'onb.4.title': '🌟 All set!',
        'onb.4.body':  'You\'re ready! If you have questions, write to edensoftwarework@gmail.com — we\'re always here.',
        'onb.4.btn':   'Let\'s go!',
        'onb.skip':    'Skip intro',

        /* ── Export ── */
        'export.json': '📥 Export JSON (backup)',
        'export.csv':  '📊 Export CSV (Excel)',
    }
};

const I18n = {
    lang: localStorage.getItem('cuidadiario_lang') || 'es',

    /** Devuelve la traducción para key en el idioma actual */
    t(key) {
        return I18N_TRANSLATIONS[this.lang]?.[key]
            || I18N_TRANSLATIONS['es'][key]
            || key;
    },

    /** Cambia el idioma y aplica al DOM */
    setLanguage(lang) {
        if (!I18N_TRANSLATIONS[lang]) return;
        this.lang = lang;
        localStorage.setItem('cuidadiario_lang', lang);
        document.documentElement.lang = lang;
        this.apply();
    },

    /** Alterna entre ES ↔ EN */
    toggleLanguage() {
        this.setLanguage(this.lang === 'es' ? 'en' : 'es');
    },

    /**
     * Aplica traducciones al DOM:
     *  1. Elementos con [data-i18n]
     *  2. Nav links por data-section
     *  3. Elementos identificables por ID
     */
    apply() {
        // 1. Elementos con data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key  = el.getAttribute('data-i18n');
            const attr = el.getAttribute('data-i18n-attr');
            const val  = this.t(key);
            if (attr) {
                el.setAttribute(attr, val);
            } else {
                el.textContent = val;
            }
        });

        // 2. Nav links
        const navMap = {
            dashboard:    'nav.dashboard',
            medicamentos: 'nav.medicamentos',
            citas:        'nav.citas',
            sintomas:     'nav.sintomas',
            tareas:       'nav.tareas',
            contactos:    'nav.contactos',
            reportes:     'nav.reportes',
        };
        document.querySelectorAll('.nav-link[data-section]').forEach(el => {
            const key = navMap[el.getAttribute('data-section')];
            if (key) el.textContent = this.t(key);
        });
        const aboutLink = document.querySelector('.nav-link[href="pages/about.html"]');
        if (aboutLink) aboutLink.textContent = this.t('nav.nosotros');

        // 3. Profile modal labels (si está en el DOM)
        this._applyId('profileNombreLabel',    'profile.name');
        this._applyId('profileEmailLabel',     'profile.email');
        this._applyId('profilePwdLabel',       'profile.pwd.new');
        this._applyId('profilePwdConfLabel',   'profile.pwd.confirm');
        this._applyId('profileTimezoneLabel',  'profile.timezone');
        this._applyId('profileSaveBtn',        'profile.save');
        this._applyId('pushNotifTitle',        'profile.push.title');
        this._applyId('pushNotifDesc',         'profile.push.desc');
        this._applyId('installTitle',          'profile.install.title');
        this._applyId('installDesc',           'profile.install.desc');

        // 4. Onboarding (si está en el DOM)
        ['1','2','3','4'].forEach(n => {
            this._applyId(`onbTitle${n}`, `onb.${n}.title`);
            this._applyId(`onbBody${n}`,  `onb.${n}.body`);
            this._applyId(`onbBtn${n}`,   `onb.${n}.btn`);
        });
        this._applyId('onbSkipBtn', 'onb.skip');

        // 5. Export buttons
        this._applyId('exportJsonBtn', 'export.json');
        this._applyId('exportCsvBtn',  'export.csv');

        // 6. Botón de idioma
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) langBtn.textContent = this.t('lang.toggle');
    },

    _applyId(id, key) {
        const el = document.getElementById(id);
        if (el) el.textContent = this.t(key);
    }
};

// Auto-aplicar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => I18n.apply());
} else {
    I18n.apply();
}

window.I18n = I18n;
window.t = (key) => I18n.t(key);
window.toggleLanguage = () => I18n.toggleLanguage();
