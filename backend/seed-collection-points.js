import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing.');
const sql = neon(process.env.DATABASE_URL);

// Addresses, accepted materials, and hours come from municipal pages.
// Coordinates are approximate OpenStreetMap street geocodes (road/segment
// centroids), not surveyed facility entrances. A null coordinate is kept when
// OSM did not return a reliable address match; those points have no distance.
const points = [
  {
    name: 'PEV Urbanova', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Dr. Dilson Lara, 80', neighborhood: 'Urbanova', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.188303, longitude: -45.931596,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Santa Luzia - Putim', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Vicente Brandão Ferreira, 293', neighborhood: 'Santa Luzia - Putim', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.243215, longitude: -45.832344,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV 31 de Março', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Guidoval, 100', neighborhood: '31 de Março', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.246901, longitude: -45.913508,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Jardim Satélite', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Estrela Dalva, 135', neighborhood: 'Jardim Satélite', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Campo dos Alemães', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas, óleo vegetal e outros materiais listados no portal municipal.',
    address: 'Avenida dos Evangélicos, 601', neighborhood: 'Campo dos Alemães', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–22:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.270415, longitude: -45.899329,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Interlagos', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Ubirajara Raimundo de Souza, 21', neighborhood: 'Interlagos', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.273169, longitude: -45.865884,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Jardim Copacabana', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Charles Diamond, 80', neighborhood: 'Jardim Copacabana', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.173706, longitude: -45.846386,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Altos de Santana', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Alto do Rio Doce, 1075', neighborhood: 'Altos de Santana', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.166686, longitude: -45.918952,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Vila Jaci', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Xavantes, 367', neighborhood: 'Vila Jaci', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.160756, longitude: -45.889376,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Jardim Jussara', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Ana Gonçalves da Cunha, 370', neighborhood: 'Jardim Jussara', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: -23.187270, longitude: -45.869362,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Pararangaba', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Sansão Peres de Andrade, 55', neighborhood: 'Pararangaba', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Dom Pedro II', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Rua Antônio Eduardo Alvarenga, 130', neighborhood: 'Dom Pedro II', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Novo Horizonte', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Tancredo Neves, 5630', neighborhood: 'Novo Horizonte', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Galo Branco', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas e óleo de cozinha usado (óleo vegetal), além de outros materiais listados no portal municipal.',
    address: 'Avenida Benedito Luiz de Medeiros, 811', neighborhood: 'Galo Branco', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV São Francisco Xavier', category: 'Entulho',
    acceptedMaterials: 'Entulho de pequenas reformas até 1 m³, volumosos, recicláveis, eletrônicos, podas, óleo vegetal e outros materiais listados no portal municipal.',
    address: 'Rua Joaquim Cláudio da Silva, s/n', neighborhood: 'São Francisco Xavier', city: 'São José dos Campos',
    openingHours: 'Segunda a sábado, 08:00–17:00; domingos e feriados, 08:00–12:00. Confirme avisos de alteração.',
    latitude: null, longitude: null,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/pevs-na-cidade/',
  },
  {
    name: 'PEV Santa Cruz 1', category: 'Recicláveis',
    acceptedMaterials: 'Vidro; confirme quais tipos e condições de embalagem são aceitos na página municipal.',
    address: 'Rua Setenta, 54', neighborhood: 'Vila Progresso', city: 'São José dos Campos',
    openingHours: 'Consulte a página municipal de Ecopontos para orientações atualizadas.',
    latitude: -23.181502, longitude: -45.877602,
    sourceUrl: 'https://www.sjc.sp.gov.br/servicos/manutencao-da-cidade/ecopontos/',
  },
  {
    name: 'PEV Caçapava - Secretaria de Obras', category: 'Recicláveis',
    acceptedMaterials: 'Materiais recicláveis, pilhas, baterias, eletrônicos e óleo de cozinha usado.',
    address: 'Rua Regente Feijó, 18', neighborhood: 'Centro', city: 'Caçapava',
    openingHours: 'Segunda a sexta, 08:00–15:00 (exceto feriados; confirme antes da visita).',
    latitude: -23.098880, longitude: -45.704210,
    sourceUrl: 'https://cacapava.sp.gov.br/noticias/geral/posto-de-entrega-voluntaria-e-reaberto-em-cacapava',
  },
  {
    name: 'LEV Jardim Santa Maria', category: 'Entulho',
    acceptedMaterials: 'LEV municipal para entrega voluntária; consulte a Prefeitura para materiais e limites vigentes.',
    address: 'Avenida Malek Assad, 725', neighborhood: 'Jardim Santa Maria', city: 'Jacareí',
    openingHours: 'Temporariamente indisponível: Prefeitura informou obras nos LEVs em 03/08/2026. Confirme reabertura na Prefeitura.',
    latitude: -23.288816, longitude: -45.969011,
    sourceUrl: 'https://www.jacarei.sp.gov.br/?s=LEV',
    active: false,
  },
  {
    name: 'LEV Jardim Flórida', category: 'Entulho',
    acceptedMaterials: 'LEV municipal para entrega voluntária; consulte a Prefeitura para materiais e limites vigentes.',
    address: 'Avenida Pensilvânia, 793', neighborhood: 'Jardim Flórida', city: 'Jacareí',
    openingHours: 'Temporariamente indisponível: Prefeitura informou obras nos LEVs em 03/08/2026. Confirme reabertura na Prefeitura.',
    latitude: -23.300956, longitude: -45.984349,
    sourceUrl: 'https://www.jacarei.sp.gov.br/?s=LEV',
    active: false,
  },
];

for (const point of points) {
  await sql`
    INSERT INTO collection_points (
      name, category, accepted_materials, address, neighborhood, opening_hours,
      city, latitude, longitude, source_url, verified, active, verified_at
    ) VALUES (
      ${point.name}, ${point.category}, ${point.acceptedMaterials}, ${point.address},
      ${point.neighborhood}, ${point.openingHours}, ${point.city}, ${point.latitude},
      ${point.longitude}, ${point.sourceUrl}, TRUE, ${point.active ?? true}, NOW()
    )
    ON CONFLICT (name, address, city) DO UPDATE SET
      category = EXCLUDED.category,
      accepted_materials = EXCLUDED.accepted_materials,
      neighborhood = EXCLUDED.neighborhood,
      opening_hours = EXCLUDED.opening_hours,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      source_url = EXCLUDED.source_url,
      verified = TRUE,
      active = ${point.active ?? true},
      verified_at = NOW()
  `;
}

await sql`DELETE FROM collection_points WHERE city = 'Caçapava' AND name = 'Posto de Entrega Voluntária (PEV)'`;
await sql`DELETE FROM collection_points WHERE city = 'São José dos Campos' AND name = 'PEV Campo dos Alemães' AND address = 'Avenida dos Evangélicos, 601'`;

const [count] = await sql`SELECT COUNT(*)::int AS count FROM collection_points WHERE verified = TRUE AND active = TRUE`;
console.log(`Synchronized ${points.length} verified municipal locations; ${count.count} verified active locations are now available.`);
