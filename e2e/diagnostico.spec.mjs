import { test, expect } from '@playwright/test';
import { checkA11y, injectAxe } from 'axe-playwright';
import { E2E_ADMIN, E2E_CONSULTA, E2E_PASSWORD } from './global-setup.mjs';

async function login(page, email) {
  await page.goto('/index.html?emulador=1&projeto=demo-lgpdsan');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible({ timeout: 15000 });
}

test('jornada completa do diagnóstico, plano, evidência, permissões e isolamento', async ({ browser }) => {
  const admin = await browser.newPage();
  await login(admin, E2E_ADMIN);
  await injectAxe(admin);
  await checkA11y(admin, { exclude: ['.firebase-emulator-warning'] }, { detailedReport: true });

  await admin.getByRole('link', { name: 'Comece por aqui' }).click();
  await expect(admin.getByRole('heading', { name: 'Comece por aqui' })).toBeVisible();
  await admin.getByLabel('Porte na Receita Federal').selectOption({ label: 'Demais' });
  await admin.getByLabel('Receita dentro do limite de pequeno porte?').selectOption({ label: 'Sim' });
  await admin.getByLabel('Integra grupo econômico acima do limite?').selectOption({ label: 'Não' });
  await admin.getByLabel('Quantidade estimada de titulares').selectOption({ label: 'Até 500' });
  await admin.getByLabel('Trata dados de saúde?').selectOption({ label: 'Não' });
  await admin.getByLabel('Trata filiação sindical?').selectOption({ label: 'Não' });
  await admin.getByLabel('Trata biometria ou dados de menores?').selectOption({ label: 'Não' });
  await admin.getByLabel('Usa IA ou tecnologia nova sobre dados?').selectOption({ label: 'Não' });
  await admin.getByLabel('Há monitoramento sistemático?').selectOption({ label: 'Não' });
  await admin.getByLabel('Há decisões automatizadas relevantes?').selectOption({ label: 'Não' });
  await admin.getByLabel('Algum cliente exigiu encarregado em contrato?').selectOption({ label: 'Não' });
  await admin.getByRole('button', { name: 'Salvar diagnóstico e continuar' }).click();
  await expect(admin.getByRole('heading', { name: /Diagnóstico inicial/ })).toBeVisible({ timeout: 30000 });
  await expect(admin.getByRole('heading', { name: 'Plano de ação' })).toBeVisible();
  await expect(admin.getByRole('cell', { name: 'Avaliar a obrigação de nomear encarregado' })).toBeVisible();

  await admin.getByRole('button', { name: 'Concluir' }).click();
  await expect(admin.getByText('concluida')).toBeVisible();
  await admin.getByRole('button', { name: 'Reabrir' }).click();
  await expect(admin.getByText('pendente')).toBeVisible();

  await admin.getByRole('button', { name: 'Evidência' }).click();
  await admin.getByLabel('Descrição *').fill('Comprovante da avaliação inicial');
  await admin.locator('input[type="file"]').setInputFiles({ name: 'comprovante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\\n%%EOF') });
  await admin.getByRole('button', { name: 'Enviar' }).click();
  await expect(admin.getByText('Evidência anexada à tarefa.')).toBeVisible({ timeout: 30000 });

  await admin.getByRole('button', { name: 'Editar' }).click();
  await admin.getByLabel('Descrição / procedimento').fill('Diagnóstico atualizado e validado.');
  await admin.getByLabel('Justificativa da alteração *').fill('Atualização E2E');
  await admin.getByRole('button', { name: 'Salvar' }).click();
  await expect(admin.getByText('v2')).toBeVisible();

  await admin.getByRole('button', { name: 'Configurações' }).click();
  await admin.getByRole('link', { name: 'Configuração do diagnóstico' }).click();
  await expect(admin.getByRole('heading', { name: 'Configuração do diagnóstico' })).toBeVisible();
  await admin.getByRole('button', { name: 'Adicionar pergunta' }).click();
  await expect(admin.getByText('Publicar nova versão')).toBeVisible();
  await admin.getByRole('button', { name: 'Prévia' }).click();
  await expect(admin.getByRole('heading', { name: 'Prévia' })).toBeVisible();
  await checkA11y(admin, { exclude: ['.firebase-emulator-warning'] }, { detailedReport: true });

  const consulta = await browser.newPage();
  await login(consulta, E2E_CONSULTA);
  await expect(consulta.getByRole('link', { name: 'Configuração do diagnóstico' })).toHaveCount(0);
  await expect(consulta.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  await consulta.evaluate(() => { location.hash = '#/registro/e2e-contab-b/registro-inexistente'; });
  await expect(consulta.getByRole('heading', { name: 'Registro não disponível' })).toBeVisible();
  await consulta.keyboard.press('Tab');
  await expect(consulta.locator(':focus')).toBeVisible();
});
