'use strict';

module.exports = function registerInstallation(app, { pool, helpers, emit }) {
  const { nowSql } = helpers;

  app.get('/api/installation/templates', async (_req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM installation_templates ORDER BY name ASC');
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[installation-templates]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/installation/settings/templates', async (_req, res) => {
    try {
      const [templates] = await pool.query('SELECT * FROM installation_templates ORDER BY name ASC');
      const [tasks] = await pool.query('SELECT * FROM installation_template_tasks ORDER BY template_id, sort_order ASC, id ASC');

      const tasksByTemplate = {};
      tasks.forEach(t => {
        if (!tasksByTemplate[t.template_id]) tasksByTemplate[t.template_id] = [];
        tasksByTemplate[t.template_id].push(t);
      });

      const data = templates.map(t => ({
        ...t,
        tasks: tasksByTemplate[t.id] || []
      }));

      res.json({ success: true, data });
    } catch (err) {
      console.error('[installation-settings-templates]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/installation/settings/templates', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Şablon adı zorunludur.' });
    try {
      const [result] = await pool.query('INSERT INTO installation_templates (name) VALUES (?)', [name]);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Kurulum şablonu oluşturuldu.' });
      res.json({ success: true, insertId: result.insertId });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/installation/settings/templates/:id', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Şablon adı zorunludur.' });
    try {
      await pool.query('UPDATE installation_templates SET name = ? WHERE id = ?', [name, req.params.id]);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Kurulum şablonu güncellendi.' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/installation/settings/templates/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM installation_templates WHERE id = ?', [req.params.id]);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Kurulum şablonu silindi.' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/installation/settings/templates/:id/tasks', async (req, res) => {
    const { task_name, sort_order, input_type, is_required } = req.body;
    if (!task_name) return res.status(400).json({ success: false, message: 'Görev adı zorunludur.' });
    try {
      const [result] = await pool.query(
        'INSERT INTO installation_template_tasks (template_id, task_name, sort_order, input_type, is_required) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, task_name, sort_order || 0, input_type || 'checkbox', is_required ? 1 : 0]
      );
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Şablon görevi eklendi.' });
      res.json({ success: true, insertId: result.insertId });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/installation/settings/tasks/:id', async (req, res) => {
    const { task_name, sort_order, input_type, is_required } = req.body;
    try {
      const updates = [];
      const values = [];
      if (task_name !== undefined) { updates.push('task_name = ?'); values.push(task_name); }
      if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
      if (input_type !== undefined) { updates.push('input_type = ?'); values.push(input_type); }
      if (is_required !== undefined) { updates.push('is_required = ?'); values.push(is_required ? 1 : 0); }
      if (updates.length === 0) return res.json({ success: true });

      values.push(req.params.id);
      await pool.query(`UPDATE installation_template_tasks SET ${updates.join(', ')} WHERE id = ?`, values);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Şablon görevi güncellendi.' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/installation/settings/tasks/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM installation_template_tasks WHERE id = ?', [req.params.id]);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Şablon görevi silindi.' });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/installation/tasks/:ticket_id', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM installation_tasks WHERE ticket_id = ? ORDER BY id ASC', [req.params.ticket_id]);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('[installation-tasks]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/installation/tasks/:task_id', async (req, res) => {
    try {
      const { is_completed, completed_by, task_value } = req.body;

      let query = 'UPDATE installation_tasks SET is_completed = ?, completed_by = ?, completed_at = ?';
      const params = [is_completed ? 1 : 0, completed_by || null, is_completed ? nowSql() : null];

      if (task_value !== undefined) {
        query += ', task_value = ?';
        params.push(task_value);
      }

      query += ' WHERE id = ?';
      params.push(req.params.task_id);

      await pool.execute(query, params);
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Görev durumu güncellendi.' });
      res.json({ success: true });
    } catch (err) {
      console.error('[update-installation-task]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.put('/api/installation/complete/:ticket_id', async (req, res) => {
    try {
      const { asset_tag, serial_no, mac_address, os_name, os_license, model_name, user_name } = req.body;
      await pool.execute(
        `UPDATE service_tickets
         SET asset_tag = ?, serial_no = ?, mac_address = ?, os_name = ?, os_license = ?, model_name = ?, user_name = ?, status = 'Tamamlandı', updated_at = ?
         WHERE id = ?`,
        [asset_tag || null, serial_no || null, mac_address || null, os_name || null, os_license || null, model_name || null, user_name || null, nowSql(), req.params.ticket_id]
      );
      emit.safeEmit('veriler-guncellendi', { mesaj: 'Cihaz kurulumu tamamlandı.' });
      res.json({ success: true });
    } catch (err) {
      console.error('[complete-installation]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
};
