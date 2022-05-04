const log = require('@helpers/logger')
const dialogflow = require('@google-cloud/dialogflow')
const projectId = process.env.PROJECT_ID
const intentsClient = new dialogflow.IntentsClient({
	credentials: JSON.parse(process.env.GCLOUD_CREDENTIALS)
})

/**
 * Lista as intents que pertencem à planilha no Dialogflow
 */
async function listIntents(sheetID) {
	const projectAgentPath = intentsClient.projectAgentPath(projectId)

	const [response] = await intentsClient.listIntents({ parent: projectAgentPath })

	const intentsForSheet = []
	for (const intent of response) {
		if (intent.displayName && intent.displayName.startsWith(`~${sheetID}.`)) {
			intentsForSheet.push({
				name: intent.name,
				displayName: intent.displayName
			})
		}
	}

	log('cyan', 'Planilhas Google', true)(`${intentsForSheet.length} intents existentes encontradas`)
	return intentsForSheet
}

module.exports = listIntents