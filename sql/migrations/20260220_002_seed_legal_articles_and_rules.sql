insert into legal_articles (codigo, nombre, descripcion, aplica_a)
values
  ('82', 'Requisitos de la demanda', 'Requisitos formales de la demanda en proceso declarativo.', 'demanda'),
  ('84', 'Anexos de la demanda', 'Documentos anexos que deben acompañar la demanda.', 'demanda'),
  ('90', 'Inadmisión de la demanda', 'Causales para inadmitir y subsanar.', 'demanda'),
  ('100', 'Rechazo de la demanda', 'Causales de rechazo in limine.', 'demanda'),
  ('422', 'Título ejecutivo', 'Requisitos del título ejecutivo para procesos ejecutivos.', 'ejecutivo')
on conflict (codigo) do nothing;

insert into rule_definitions (nombre, descripcion, condicion_json, resultado, fundamento, prioridad, activo)
values
  (
    'Rechazo por caducidad',
    'Si existe caducidad, se sugiere rechazo de la demanda.',
    '{"op":"is_true","field":"caducidad"}'::jsonb,
    'auto_rechaza_demanda',
    'Se advierte caducidad conforme al análisis procesal y reglas aplicables del CGP.',
    1,
    true
  ),
  (
    'Inadmisión por requisitos incompletos',
    'Si faltan requisitos del art. 82 o anexos, se sugiere inadmisión.',
    '{"op":"or","conditions":[{"op":"is_false","field":"cumple_art_82"},{"op":"is_false","field":"anexos_completos"}]}'::jsonb,
    'auto_inadmisorio',
    'No se evidencia cumplimiento integral de requisitos formales de la demanda.',
    2,
    true
  ),
  (
    'Mandamiento de pago en ejecutivo válido',
    'Si es ejecutivo y existe título ejecutivo válido, se sugiere mandamiento de pago.',
    '{"op":"and","conditions":[{"op":"eq","field":"tipo_proceso","value":"ejecutivo"},{"op":"is_true","field":"titulo_ejecutivo_valido"}]}'::jsonb,
    'mandamiento_pago',
    'Se cumplen presupuestos para librar mandamiento de pago en proceso ejecutivo.',
    3,
    true
  ),
  (
    'Admisión por cumplimiento integral',
    'Si no hay causales impeditivas y se cumplen requisitos, se sugiere admisión.',
    '{"op":"and","conditions":[{"op":"is_true","field":"cumple_art_82"},{"op":"is_true","field":"anexos_completos"},{"op":"is_true","field":"competencia_valida"},{"op":"is_false","field":"caducidad"},{"op":"is_false","field":"prescripcion"}]}'::jsonb,
    'auto_admisorio',
    'Se observa cumplimiento formal y material para admisión de la demanda.',
    4,
    true
  );