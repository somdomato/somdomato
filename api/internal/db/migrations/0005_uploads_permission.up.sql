-- Permissão para a nova tela /admin/envios (ver internal/uploads,
-- internal/groqeval): editar, aprovar ou rejeitar manualmente uma faixa
-- ainda não avaliada (ou já avaliada) pela IA.
INSERT INTO role_permissions (role, permission) VALUES
    ('admin', 'uploads:manage'),
    ('super_admin', 'uploads:manage');
