// Základní údaje o podniku – upravte dle potřeby.
export const site = {
    name: 'Hostinec na Faře',
    tagline: 'Poctivá česká kuchyně a dobře ošetřené pivo',
    about: 'Popis restaurace - o nás',
    address: 'Vrčeň 155, 33541 Vrčeň',
    phone: '+420 722 567 802',
    email: 'koudelkamil@email.cz',
    hours: {
        'Po, St': '11:00 – 14:30',
        'Út,Čt': '11:00 – 20:00',
        'Pá, So': '11:00 – 22:00',
        'Ne': 'Zavřeno',
    } as Record<string, string>,
    lunchHours: 'Polední menu podáváme Po – Pá 11:00 – 14:30',
    orderInfo: 'Objednávky na rozvoz do 14:00 předchozího dne na WhatsApp 722 567 802 nebo e-mailem na koudelkamil@email.cz. Dobrou chuť Vám přeje tým Hostince Na Faře.',
};
