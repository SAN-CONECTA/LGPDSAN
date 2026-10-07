// Guias de conformidade por categoria. Cada guia vira um checklist dentro do registro (campo `dados`).
// Fonte do conteúdo: "Contratos e Operadores — Guia de Conformidade LGPD para Escritório de Contabilidade" (2026).
// Itens com extra:true foram acrescentados pela equipe técnica (não estão no guia original) e precisam de validação jurídica.

import { GUIA_DIREITOS } from './guia-direitos.js?v=2.7.0';
import { GUIA_GOVERNANCA } from './guia-governanca.js?v=2.7.0';
import { GUIA_MAPEAMENTO } from './guia-mapeamento.js?v=2.7.0';
import { GUIA_RETENCAO } from './guia-retencao.js?v=2.7.0';
import { GUIA_SEGURANCA } from './guia-seguranca.js?v=2.7.0';
import { GUIA_TREINAMENTO } from './guia-treinamento.js?v=2.7.0';
import { GUIA_INCIDENTES } from './guia-incidentes.js?v=2.7.0';
import { GUIA_EMAIL } from './guia-email.js?v=2.7.0';

export const RESP = ['Conforme', 'Parcial', 'Não conforme', 'N/A']; // 'Não avaliado' = campo vazio

export const GUIAS = {
  'Contratos e Operadores': {
    titulo: 'Contratos e Operadores',
    tituloHint: 'Nome do operador (ex.: Cloudtech Brasil Soluções Ltda.)',
    resumo: 'Um registro por operador: fornecedor, plataforma em nuvem ou prestador que trata dados pessoais em nome do escritório. Responda o checklist com base no contrato assinado.',
    secoes: [
      { id: 's1', titulo: '1. Identificação do operador', itens: [
        { id: 'razao', tipo: 'texto', label: 'Nome / razão social completa', ajuda: 'Base para rastreabilidade e ação legal.' },
        { id: 'pessoa', tipo: 'select', label: 'Tipo de pessoa', opcoes: ['Jurídica', 'Física'] },
        { id: 'doc', tipo: 'texto', label: 'CNPJ ou CPF' },
        { id: 'end', tipo: 'texto', label: 'Endereço completo (sede/filial onde os dados são processados)', ajuda: 'Define a jurisdição aplicável em auditorias e incidentes.' },
        { id: 'contato', tipo: 'texto', label: 'Telefone e e-mail do contato (gerente de conta)' },
        { id: 'repr', tipo: 'texto', label: 'Responsável legal / representante que assina o contrato' },
        { id: 'servico', tipo: 'area', label: 'Descrição detalhada do serviço', ajuda: 'O que exatamente o operador faz. Ex.: hospedagem de servidor com backups diários.' },
        { id: 'tipoop', tipo: 'select', label: 'Tipo de operador', opcoes: ['Software / ERP / contabilidade em nuvem', 'Provedor de nuvem / hospedagem', 'Backup e recuperação de desastres', 'Consultoria / auditoria externa', 'Contabilidade terceirizada ou filial', 'Limpeza / manutenção (acesso físico)', 'Segurança (CFTV, vigilância)', 'Assinatura digital', 'E-mail corporativo', 'Marketing / comunicação', 'Outro'] },
        { id: 'c_ident', tipo: 'sn', label: 'O contrato assinado está arquivado (físico ou digital) com todas as informações acima?' }
      ] },
      { id: 's2', titulo: '2. Dados pessoais processados', itens: [
        { id: 'dadosCat', tipo: 'multi', label: 'Categorias de dados que o operador processa', opcoes: ['Dados de clientes', 'Dados de funcionários', 'Dados fiscais / IRPF', 'Dados de fornecedores', 'Metadados de acesso (IP, logins, atividades)'] },
        { id: 'c_dados', tipo: 'sn', label: 'O contrato especifica exatamente quais dados pessoais são processados (campo a campo)?', ajuda: 'Dados de fornecedor e metadados exigem menor rigor, mas devem ser mencionados.' },
        { id: 'c_inv', tipo: 'sn', label: 'Existe o anexo "Inventário de Dados Processados", classificando cada campo (público, interno, confidencial, sensível)?' },
        { id: 'c_invAtual', tipo: 'sn', label: 'O anexo é atualizado sempre que novos dados passam a ser tratados?' },
        { id: 'c_sens', tipo: 'sn', extra: true, label: 'Dados sensíveis (art. 5º, II da LGPD: saúde, biometria, filiação sindical, origem racial, etc.), se houver, foram identificados e têm proteção reforçada?', ajuda: 'Item acrescentado: dados financeiros e fiscais são de alto risco, mas a lei não os lista como sensíveis. O guia original os marca como sensíveis; validar o critério adotado.' }
      ] },
      { id: 's3', titulo: '3. Tipo de processamento', itens: [
        { id: 'procTipos', tipo: 'multi', label: 'Operações que o operador realiza', opcoes: ['Armazenamento', 'Análise / processamento', 'Transmissão (integrações)', 'Backup', 'Limpeza / exclusão', 'Compartilhamento com terceiros (fisco, bancos)', 'Acesso administrativo (sem ver dados pessoais)', 'Auditoria / conformidade'] },
        { id: 'c_proc', tipo: 'sn', label: 'O contrato descreve essas operações?', ajuda: 'Ex.: "armazenamento em nuvem (região São Paulo), backup automático diário e transmissão segura via API para o sistema de folha".' }
      ] },
      { id: 's4', titulo: '4. Localização dos dados', itens: [
        { id: 'local', tipo: 'select', label: 'Onde os dados são armazenados e processados', opcoes: ['Brasil (servidor local)', 'Nuvem com região no Brasil', 'Nuvem internacional (EUA, UE, etc.)', 'Múltiplas regiões (replicação global)'] },
        { id: 'c_local', tipo: 'sn', label: 'O contrato registra a localização dos dados?' },
        { id: 'c_intl', tipo: 'sn', label: 'Se há transferência internacional: o contrato tem cláusula específica e a hipótese legal do art. 33 da LGPD está documentada?', ajuda: 'O guia cita consentimento do cliente final. O art. 33 prevê outras hipóteses (cláusulas contratuais padrão da ANPD, país com nível adequado de proteção, entre outras): validar qual se aplica.' },
        { id: 'c_multi', tipo: 'sn', label: 'Se há replicação em várias regiões: existe autorização documentada e auditoria periódica do operador?' }
      ] },
      { id: 's5', titulo: '5. Retenção e exclusão', itens: [
        { id: 'c_ret', tipo: 'sn', label: 'O contrato especifica por quanto tempo cada tipo de dado é retido?' },
        { id: 'retContab', tipo: 'texto', label: 'Prazo contratado: dados contábeis / livros fiscais', ajuda: 'Referência do guia: 5 anos, mesmo após o fim do contrato. Confirmar o fundamento legal com assessoria jurídica (o guia cita norma incorreta; a base usual é o Código Tributário Nacional, Lei 5.172/1966).' },
        { id: 'retRH', tipo: 'texto', label: 'Prazo contratado: folha de pagamento / RH', ajuda: 'Referência do guia: mínimo de 2 anos, recomendado 5. Validar: obrigações trabalhistas, previdenciárias e de FGTS podem exigir prazos maiores.' },
        { id: 'retCli', tipo: 'texto', label: 'Prazo contratado: dados de cliente após o encerramento', ajuda: 'Referência do guia: 2 anos; pode variar conforme o contrato com o cliente.' },
        { id: 'c_bkp', tipo: 'sn', label: 'Backups seguem o mesmo prazo dos dados originais, com destruição certificada após o vencimento?' },
        { id: 'c_logs', tipo: 'sn', label: 'O prazo de retenção de logs de auditoria e acesso está definido?', ajuda: 'O guia original deixou esta linha em branco: definir internamente.' }
      ] },
      { id: 's6', titulo: '6. Incidentes', itens: [
        { id: 'c_incid', tipo: 'sn', extra: true, label: 'O contrato define canal e prazo para o operador avisar o escritório sobre incidente de segurança?', ajuda: 'Item acrescentado a partir da menção a "72h" no guia. A ANPD exige que o controlador comunique incidente em 3 dias úteis (6 para agentes de pequeno porte; Res. CD/ANPD 15/2024), então o operador precisa avisar antes disso. Validar o prazo contratual.' }
      ] }
    ],
    // Alertas calculados a partir das respostas.
    alertas: d => {
      const a = [];
      const intl = ['Nuvem internacional (EUA, UE, etc.)', 'Múltiplas regiões (replicação global)'].includes(d.local);
      if (intl && d.c_intl !== 'Conforme') a.push('Dados fora do Brasil sem cláusula e hipótese legal de transferência internacional confirmadas.');
      if (d.local === 'Múltiplas regiões (replicação global)' && d.c_multi !== 'Conforme') a.push('Replicação em várias regiões sem autorização documentada e auditoria periódica.');
      if (d.c_inv === 'Não conforme') a.push('Sem inventário de dados processados anexado ao contrato.');
      if (d.c_ret === 'Não conforme') a.push('Contrato sem prazos de retenção.');
      if (d.c_incid === 'Não conforme') a.push('Contrato sem canal e prazo para aviso de incidente.');
      return a;
    },
    referencia: `
      <h3>O que é um operador</h3>
      <p>Pessoa física ou jurídica que trata dados pessoais <b>em nome do controlador</b>, sem autonomia de decisão sobre o tratamento. Exemplos num escritório de contabilidade: softwares e ERPs em nuvem, provedores de nuvem, backup e recuperação, consultores e auditores externos, contadores terceirizados ou filiais, limpeza e manutenção com acesso físico, segurança (CFTV), assinatura digital, e-mail corporativo e agências de marketing que usem dados de clientes.</p>
      <h3>Controlador x operador</h3>
      <p><b>Controlador</b> define quais dados, para quê e como tratar. <b>Operador</b> trata conforme as instruções do controlador (art. 39 da LGPD), mediante contrato. Ambos respondem por danos causados pelo tratamento irregular (art. 42).</p>
      <p><b>Atenção ao papel do escritório:</b> para os dados dos clientes-empresa e de seus funcionários, o escritório frequentemente atua como operador (o cliente é o controlador). Para a própria equipe e clientes pessoa física, tende a ser controlador. Validar caso a caso com assessoria jurídica.</p>
      <h3>Notas de revisão do guia original</h3>
      <p>Pontos do guia recebido que divergem da lei ou de normas da ANPD e que <b>não foram copiados</b> para este checklist:</p>
      <ul>
        <li>"LGPD Art. 2, inciso I" e "Art. 28" para a responsabilidade do operador: o art. 28 foi vetado; as referências corretas são os arts. 5º (VI e VII), 39 e 42.</li>
        <li>"Lei 8.383/1991 (Código Tributário)": o Código Tributário Nacional é a Lei 5.172/1966; a Lei 8.383/1991 trata de outro assunto.</li>
        <li>"CLT Art. 29" como base de retenção de folha por 2 anos e "LGPD Art. 14" como base de retenção de dados de cliente: não sustentam esses prazos (o art. 14 trata de dados de crianças e adolescentes).</li>
        <li>Dados financeiros e fiscais marcados como "sensíveis": o art. 5º, II da LGPD não os inclui no rol. São dados de alto risco, mas tecnicamente não sensíveis.</li>
        <li>Transferência internacional "exige consentimento": o art. 33 prevê várias hipóteses; o consentimento é só uma delas.</li>
        <li>Aviso de incidente em "72h": o prazo da ANPD para o controlador é de 3 dias úteis (Res. CD/ANPD 15/2024).</li>
        <li>O documento termina na seção 2.5 (linha de logs em branco). Cláusulas essenciais, direitos e obrigações, término e exclusão de dados, e templates de checklist constam do sumário, mas não vieram no arquivo.</li>
      </ul>`
  }
};
GUIAS['Tratamento de Email'] = GUIA_EMAIL;
GUIAS['Direitos dos Titulares'] = GUIA_DIREITOS;
GUIAS['Governança e Políticas'] = GUIA_GOVERNANCA;
GUIAS['Incidentes'] = GUIA_INCIDENTES;
GUIAS['Mapeamento de Dados'] = GUIA_MAPEAMENTO;
GUIAS['Retenção e Descarte'] = GUIA_RETENCAO;
GUIAS['Segurança da Informação'] = GUIA_SEGURANCA;
GUIAS['Treinamento e Cultura'] = GUIA_TREINAMENTO;

// Helpers
export const guiaDe = cat => GUIAS[cat] || null;
export const itensDe = g => g.secoes.flatMap(s => s.itens);
export const fmtVal = v => Array.isArray(v) ? v.join(', ') : (v ?? '');
export function progresso(g, d) {
  const sn = itensDe(g).filter(i => i.tipo === 'sn');
  let ok = 0, parcial = 0, nao = 0, na = 0, pend = 0;
  sn.forEach(i => { const v = (d || {})[i.id]; if (v === 'Conforme') ok++; else if (v === 'Parcial') parcial++; else if (v === 'Não conforme') nao++; else if (v === 'N/A') na++; else pend++; });
  const aplic = sn.length - na;
  return { total: sn.length, ok, parcial, nao, na, pend, pct: aplic ? Math.round(ok / aplic * 100) : 0 };
}
