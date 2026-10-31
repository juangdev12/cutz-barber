document.addEventListener('DOMContentLoaded', function() {
  // Configuración de Supabase
  const SUPABASE_URL = 'https://turklfcpoaqzaouzesms.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_23pXoL6f2kdizx2iaJvoeQ_XzSmzaJH';
  const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  // Utilidades de selección
  function $(s) { return document.querySelector(s); }
  function $$(s) { return document.querySelectorAll(s); }

  // Función de seguridad: Escapar caracteres HTML (Protección contra XSS)
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ==========================================
     MENÚ DESPLEGABLE MINIMALISTA (HAMBURGUESA)
     ========================================== */
  var bg = $('#bg'), mn = $('#menu');
  function tog(o) {
    if(bg) bg.setAttribute('aria-expanded', o);
    if(mn) mn.classList.toggle('open', o);
  }

  if (bg && mn) {
    bg.onclick = function (e) {
      e.stopPropagation();
      tog(bg.getAttribute('aria-expanded') !== 'true');
    };
    mn.addEventListener('click', function (e) { 
      if (e.target.tagName === 'A') tog(false); 
    });
    document.addEventListener('click', function (e) { 
      if (!mn.contains(e.target) && !bg.contains(e.target)) tog(false); 
    });
    document.addEventListener('keydown', function (e) { 
      if (e.key === 'Escape') tog(false); 
    });
  }

  /* ==========================================
     SCROLL REVEAL (EFECTOS DE DESPLAZAMIENTO)
     ========================================== */
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  $$('.m, .r, .eyebrow, .grid figure, .row, .step').forEach(el => {
    observer.observe(el);
  });

  /* ==========================================
     SISTEMA DE RESERVAS (FRANJAS DE 30 MIN)
     ========================================== */
  const fechaInput = $('#fecha-input');
  const grillaHorarios = $('#grilla-horarios');
  const horaSeleccionadaInput = $('#hora-seleccionada');
  const bookingForm = $('#f');

  // Horarios estándar por defecto (Fallback si no hay tabla de configuración)
  const HORARIOS_PREDETERMINADOS = [
    "10:00", "10:30", "11:00", "11:30", "12:00", "12:30",
    "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
  ];

  if (fechaInput) {
    const hoyArg = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    fechaInput.min = hoyArg;
    fechaInput.value = hoyArg;
    fechaInput.addEventListener('change', function() {
      cargarHorariosDisponibles(this.value);
    });
    cargarHorariosDisponibles(hoyArg);
  }

  async function cargarHorariosDisponibles(fechaSeleccionada) {
    if (!grillaHorarios) return;
    
    grillaHorarios.innerHTML = `<p style="grid-column: span 4; color: var(--mut); font-size: 0.9rem; text-align: center; padding: 1rem 0;">Cargando horarios...</p>`;
    if (horaSeleccionadaInput) horaSeleccionadaInput.value = '';

    const [anio, mes, dia] = fechaSeleccionada.split('-').map(Number);
    const fechaObj = new Date(anio, mes - 1, dia);
    let diaSemana = fechaObj.getDay(); // 0: Domingo, 1: Lunes, ..., 6: Sábado

    if (diaSemana === 0) {
      grillaHorarios.innerHTML = `<p style="grid-column: span 4; color: #ff5555; text-align: center; padding: 1rem 0;">Domingos cerrado.</p>`;
      return;
    }

    let franjasHorarias = [];

    if (supabaseClient) {
      try {
        const { data: configDia } = await supabaseClient
          .from('horarios_atencion')
          .select('turnos_json, activo')
          .eq('dia_semana', diaSemana)
          .maybeSingle();

        if (configDia && configDia.activo && configDia.turnos_json) {
          franjasHorarias = configDia.turnos_json;
        }
      } catch (e) {
        console.warn('No se pudo obtener la configuración de horarios, usando estándar.', e);
      }
    }

    // Usar horarios predeterminados si no vino nada de la base de datos
    if (franjasHorarias.length === 0) {
      franjasHorarias = HORARIOS_PREDETERMINADOS;
    }

    // Detectar si la fecha seleccionada es el día de HOY en Argentina
    const hoyArgStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const esHoy = (fechaSeleccionada === hoyArgStr);

    let horaActualMinutos = 0;
    if (esHoy) {
      const horaArgStr = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
      const [hNow, mNow] = horaArgStr.split(':').map(Number);
      horaActualMinutos = hNow * 60 + mNow;
    }

    let turnosOcupados = [];

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('turnos')
          .select('fecha_hora')
          .in('estado', ['confirmado', 'pendiente']);

        if (!error && data) {
          turnosOcupados = data.map(t => {
            const dateObj = new Date(t.fecha_hora);
            const dStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
            const hStr = dateObj.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
            return { fecha: dStr, hora: hStr };
          }).filter(t => t.fecha === fechaSeleccionada).map(t => t.hora);
        }
      } catch (err) {
        console.error('Error al consultar turnos ocupados:', err);
      }
    }

    grillaHorarios.innerHTML = '';

    franjasHorarias.forEach(hora => {
      const btnHora = document.createElement('button');
      btnHora.type = 'button';
      btnHora.textContent = hora;
      btnHora.className = 'time-slot-btn';

      // Calcular minutos de este turno para comparar si ya pasó
      const [hSlot, mSlot] = hora.split(':').map(Number);
      const slotMinutos = hSlot * 60 + mSlot;

      const yaPasoElHorario = esHoy && (slotMinutos <= horaActualMinutos);
      const estaOcupado = turnosOcupados.includes(hora);

      if (yaPasoElHorario) {
        btnHora.disabled = true;
        btnHora.classList.add('disabled');
        btnHora.title = 'Horario ya expirado';
      } else if (estaOcupado) {
        btnHora.disabled = true;
        btnHora.classList.add('disabled');
        btnHora.title = 'Horario Ocupado';
      } else {
        btnHora.addEventListener('click', function() {
          $$('.time-slot-btn').forEach(b => b.classList.remove('selected'));
          btnHora.classList.add('selected');
          if (horaSeleccionadaInput) horaSeleccionadaInput.value = hora;
        });
      }

      grillaHorarios.appendChild(btnHora);
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Control Anti-Spam: Limitar reservas consecutivas por dispositivo (2 minutos)
      const ultimaReserva = localStorage.getItem('cutz_last_booking');
      const ahora = Date.now();
      if (ultimaReserva && (ahora - Number(ultimaReserva) < 120000)) {
        alert('Por favor, aguarda un par de minutos antes de realizar otra reserva.');
        return;
      }

      const servicio = $('#s').value;
      const fecha = $('#fecha-input').value;
      const hora = horaSeleccionadaInput ? horaSeleccionadaInput.value : '';
      const nombreRaw = $('#n').value.trim();
      const telefonoRaw = $('#t').value.trim();

      // Sanitizado de datos
      const nombre = escapeHTML(nombreRaw);
      const telefono = escapeHTML(telefonoRaw);

      if (!hora) {
        alert('Por favor, selecciona un horario disponible.');
        return;
      }

      const [anio, mes, dia] = fecha.split('-').map(Number);
      const [h, m] = hora.split(':').map(Number);
      const fechaLocalObj = new Date(anio, mes - 1, dia, h, m, 0);
      const isoString = fechaLocalObj.toISOString();

      if (supabaseClient) {
        const { data: turnosExistentes } = await supabaseClient
          .from('turnos')
          .select('*')
          .in('estado', ['confirmado', 'pendiente']);

        const yaOcupado = (turnosExistentes || []).some(t => {
          const dateObj = new Date(t.fecha_hora);
          const dStr = dateObj.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
          const hStr = dateObj.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });
          return dStr === fecha && hStr === hora;
        });

        if (yaOcupado) {
          alert('❌ Lo sentimos, este horario acaba de ser reservado por otro cliente. Por favor, selecciona otro.');
          cargarHorariosDisponibles(fecha);
          return;
        }

        const { error } = await supabaseClient
          .from('turnos')
          .insert([{
            nombre: nombre,
            telefono: telefono,
            servicio: servicio,
            fecha_hora: isoString,
            estado: 'confirmado'
          }]);

        if (error) {
          alert('Error al registrar el turno: ' + error.message);
          return;
        }
      }

      // Guardar marca de tiempo para evitar spam
      localStorage.setItem('cutz_last_booking', Date.now());

      const fechaFormateada = new Date(anio, mes - 1, dia).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
      const mensaje = encodeURIComponent(`Hola! Reservé un turno en Cutz Studio.\n\n👤 Nombre: ${nombreRaw}\n✂️ Servicio: ${servicio}\n📅 Fecha: ${fechaFormateada}\n⏰ Hora: ${hora} hs`);
      
      window.open(`https://wa.me/5492478516972?text=${mensaje}`, '_blank');
      
      alert('¡Turno reservado con éxito!');
      bookingForm.reset();
      if (fechaInput) {
        const hoyArg = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
        fechaInput.value = hoyArg;
      }
      cargarHorariosDisponibles(fechaInput.value);
    });
  }
});