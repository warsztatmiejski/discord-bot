// warsztat-miejski.js - Knowledge Base Logic

const fs = require('fs');
const path = require('path');

// Load knowledge from JSON file
const knowledgePath = path.resolve(__dirname, 'warsztat-miejski.json');
const workshopKnowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));

// Smart context injection based on user question
function getRelevantContext(userText) {
	const context = [];
	const text = userText.toLowerCase();
	const keywords = workshopKnowledge.keywords;

	// Basic info
	if (keywords.basic.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const basic = workshopKnowledge.basic;
		context.push(`${basic.name}: ${basic.mission}. Założony w ${basic.founded} w ${basic.location}. Adres: ${basic.address}. Website: ${basic.website}. KRS: ${basic.krs}`);
	}

	// Financial info
	if (keywords.financial.some(keyword => new RegExp(keyword, 'i').test(text)) ||
		/opłac|płac|payment|pay/i.test(text)) {
		const financial = workshopKnowledge.financial;
		context.push(`Płatności: Konto bankowe ${financial.bankAccount}. Składka członkowska: ${financial.membershipFee}. Cele przelewów: ${financial.paymentPurposes.join(', ')}`);
	}

	// Access and rules
	if (keywords.access.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const access = workshopKnowledge.officialRules.access;
		context.push(`Dostęp: ${access.join('. ')}`);
	}

	if (keywords.rules.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const rules = workshopKnowledge.officialRules.behavior;
		context.push(`Zasady zachowania: ${rules.join('. ')}`);
	}

	// Membership
	if (keywords.membership.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const membership = workshopKnowledge.membership;
		context.push(`Członkostwo: Typy - ${membership.types.join(', ')}. Prawa: ${membership.rights.join('. ')}. Obowiązki: ${membership.duties.join('. ')}`);
	}

	// Projects and storage
	if (keywords.projects.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const projects = workshopKnowledge.officialRules.projects;
		context.push(`Projekty: ${projects.join('. ')}`);
	}

	// Spaces and tools
	if (keywords.woodworking.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const wood = workshopKnowledge.spaces.woodworking;
		context.push(`Przestrzeń drewna: ${wood.description}. Narzędzia: ${wood.mainTools.join(', ')}. ${wood.safety}`);
	}

	if (keywords.electronics.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const elec = workshopKnowledge.spaces.electronics;
		context.push(`Lab elektroniki: ${elec.description}. Narzędzia: ${elec.mainTools.join(', ')}. ${elec.safety}`);
	}

	if (keywords.ceramics.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const ceram = workshopKnowledge.spaces.ceramics;
		context.push(`Ceramika: ${ceram.description}. Narzędzia: ${ceram.mainTools.join(', ')}. ${ceram.safety}`);
	}

	if (keywords.darkroom.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const dark = workshopKnowledge.spaces.darkroom;
		context.push(`Ciemnia: ${dark.description}. Wyposażenie: ${dark.mainTools.join(', ')}. ${dark.safety}`);
	}

	// Safety and rules
	if (keywords.safety.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const safety = workshopKnowledge.officialRules.safety;
		const generalSafety = workshopKnowledge.safetyTips.general;
		context.push(`Zasady BHP: ${safety.join('. ')}`);
		context.push(`Ogólne bezpieczeństwo: ${generalSafety.join('. ')}`);
	}

	// Calculations (useful with code_interpreter)
	if (keywords.calculations.some(keyword => new RegExp(keyword, 'i').test(text))) {
		const calc = workshopKnowledge.commonCalculations.electronics;
		context.push(`Prawo Ohma: ${calc.ohmsLaw}`);
	}

	return context.length > 0 ? '\n\nKontekst Warsztatu:\n' + context.join('\n') : '';
}

module.exports = {
	workshopKnowledge,
	getRelevantContext
};