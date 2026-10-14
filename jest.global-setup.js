// Fixa o fuso dos testes: as regras de dia/meia-noite/horas noturnas dependem do horário local.
module.exports = async () => {
  process.env.TZ = 'America/Sao_Paulo';
};
