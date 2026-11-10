const db = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const [rows] = await db.query('SELECT id, nombre, precio_hora FROM tarifas');
    return res.status(200).json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener tarifas: ' + error.message });
  }
};