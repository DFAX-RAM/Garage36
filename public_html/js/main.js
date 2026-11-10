document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('form-login');
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usuario = document.getElementById('usuario').value.trim();
      const password = document.getElementById('password').value.trim();
      const msgBox = document.getElementById('mensaje-login');

      msgBox.textContent = '';

      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario, password })
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          localStorage.setItem('usuario_garage', data.usuario);
          window.location.href = 'admin.html';
        } else {
          msgBox.textContent = data.error || 'Credenciales incorrectas';
        }
      } catch (err) {
        msgBox.textContent = 'Error de conexión con el servidor';
      }
    });
  }

  const tablaEstancias = document.getElementById('tabla-estancias');
  if (tablaEstancias) {
    cargarTarifas();
    cargarEstancias();

    const formEntrada = document.getElementById('form-entrada');
    const msgEntrada = document.getElementById('msg-entrada');

    formEntrada.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEntrada.textContent = '';
      msgEntrada.className = 'msg-box';

      const datos = {
        placa: document.getElementById('placa').value.trim(),
        espacio: document.getElementById('espacio').value.trim(),
        tarifa_id: document.getElementById('tarifa_id').value
      };

      try {
        const res = await fetch('/api/estancias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos)
        });

        const data = await res.json();

        if (res.ok && data.ok) {
          msgEntrada.textContent = 'Vehículo ingresado con éxito';
          msgEntrada.classList.add('msg-success');
          formEntrada.reset();
          cargarEstancias();
        } else {
          msgEntrada.textContent = data.error || 'Error al guardar la entrada';
          msgEntrada.classList.add('msg-error');
        }
      } catch (err) {
        msgEntrada.textContent = 'Error de conexión';
        msgEntrada.classList.add('msg-error');
      }
    });

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        localStorage.removeItem('usuario_garage');
        window.location.href = 'index.html';
      });
    }
  }
});

async function cargarTarifas() {
  const select = document.getElementById('tarifa_id');
  if (!select) return;

  try {
    const res = await fetch('/api/tarifas');
    const tarifas = await res.json();

    if (Array.isArray(tarifas)) {
      select.innerHTML = tarifas.map(t => 
        `<option value="${t.id}">${t.nombre} (Q${Number(t.precio_hora).toFixed(2)}/h)</option>`
      ).join('');
    }
  } catch (err) {
    select.innerHTML = '<option value="">Error al cargar tarifas</option>';
  }
}

async function cargarEstancias() {
  const tbody = document.getElementById('tbody-estancias');
  if (!tbody) return;

  try {
    const res = await fetch('/api/estancias');
    const estancias = await res.json();

    if (!Array.isArray(estancias) || estancias.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay registros disponibles.</td></tr>';
      return;
    }

    tbody.innerHTML = estancias.map(e => {
      const esActiva = e.estado === 'ACTIVA';
      const fechaEntrada = new Date(e.hora_entrada);
      const horaFormateada = fechaEntrada.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td class="mono-cell">${e.placa}</td>
          <td class="mono-cell">${e.espacio}</td>
          <td>${horaFormateada}</td>
          <td>${e.tarifa_nombre}</td>
          <td><span class="badge ${esActiva ? 'badge-activa' : 'badge-finalizada'}">${e.estado}</span></td>
          <td>
            ${esActiva 
              ? `<button class="btn btn-sm btn-success" onclick="cobrarEstancia(${e.id})">Cobrar y Salir</button>` 
              : `<span class="mono-cell">Q${Number(e.total).toFixed(2)}</span>`}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--red-accent);">Error al cargar datos</td></tr>';
  }
}

async function cobrarEstancia(id) {
  if (!confirm('¿Deseas procesar la salida y el cobro de este vehículo?')) return;

  try {
    const res = await fetch('/api/estancias', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estancia_id: id, metodo_pago: 'EFECTIVO' })
    });

    const data = await res.json();

    if (res.ok && data.ok) {
      const c = data.comprobante;
      const url = `comprobante.html?id=${c.estancia_id}&placa=${encodeURIComponent(c.placa)}&espacio=${encodeURIComponent(c.espacio)}&horas=${c.horas}&total=${c.total}`;
      
      window.open(url, '_blank', 'width=380,height=520');
      cargarEstancias();
    } else {
      alert(data.error || 'No se pudo procesar el cobro');
    }
  } catch (err) {
    alert('Error al conectar con el servidor para realizar el cobro');
  }
}