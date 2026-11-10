const db = require('./db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const [rows] = await db.query(`
        SELECT 
          e.id, 
          e.placa, 
          e.espacio, 
          e.hora_entrada, 
          e.hora_salida, 
          e.total, 
          e.estado, 
          t.nombre AS tarifa_nombre, 
          t.precio_hora
        FROM estancias e
        JOIN tarifas t ON e.tarifa_id = t.id
        ORDER BY e.id DESC
      `);
      return res.status(200).json(rows);
    } catch (error) {
      return res.status(500).json({ error: 'Error al consultar estancias: ' + error.message });
    }
  }

  if (req.method === 'POST') {
    const { placa, espacio, tarifa_id } = req.body || {};

    if (!placa || !espacio || !tarifa_id) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
      const [existentes] = await db.query(
        'SELECT id FROM estancias WHERE placa = ? AND estado = "ACTIVA"',
        [placa.toUpperCase().trim()]
      );

      if (existentes.length > 0) {
        return res.status(400).json({ error: 'Este vehículo ya tiene una estancia activa.' });
      }

      await db.query(
        'INSERT INTO estancias (placa, espacio, tarifa_id, hora_entrada, estado) VALUES (?, ?, ?, NOW(), "ACTIVA")',
        [placa.toUpperCase().trim(), espacio.toUpperCase().trim(), tarifa_id]
      );

      return res.status(201).json({ ok: true, mensaje: 'Entrada registrada correctamente' });
    } catch (error) {
      return res.status(500).json({ error: 'Error al registrar entrada: ' + error.message });
    }
  }

  if (req.method === 'PUT') {
    const { estancia_id, metodo_pago } = req.body || {};

    if (!estancia_id) {
      return res.status(400).json({ error: 'El ID de la estancia es requerido' });
    }

    try {
      const [rows] = await db.query(
        `SELECT e.id, e.placa, e.espacio, e.hora_entrada, t.precio_hora 
         FROM estancias e 
         JOIN tarifas t ON e.tarifa_id = t.id 
         WHERE e.id = ? AND e.estado = "ACTIVA"`,
        [estancia_id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'La estancia no existe o ya fue finalizada' });
      }

      const estancia = rows[0];
      const entrada = new Date(estancia.hora_entrada);
      const salida = new Date();

      const diffMs = salida - entrada;
      const minutos = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
      const horasACobrar = Math.ceil(minutos / 60);
      const total = horasACobrar * Number(estancia.precio_hora);

      await db.query(
        'UPDATE estancias SET hora_salida = NOW(), total = ?, estado = "FINALIZADA" WHERE id = ?',
        [total, estancia_id]
      );

      await db.query(
        'INSERT INTO pagos (estancia_id, monto, metodo_pago, fecha_pago) VALUES (?, ?, ?, NOW())',
        [estancia_id, total, metodo_pago || 'EFECTIVO']
      );

      return res.status(200).json({
        ok: true,
        mensaje: 'Cobro y salida procesados exitosamente',
        comprobante: {
          estancia_id: estancia.id,
          placa: estancia.placa,
          espacio: estancia.espacio,
          horas: horasACobrar,
          total: total.toFixed(2),
          fecha: salida.toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({ error: 'Error al procesar cobro: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Método no permitido' });
};