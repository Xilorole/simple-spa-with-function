// ──────────────────────────────────────────────
// simple-spa-with-function  – Infrastructure
// ──────────────────────────────────────────────
targetScope = 'resourceGroup'

@description('Primary location for all resources')
param location string = resourceGroup().location

@description('A short, unique suffix appended to resource names (e.g. "dev", "prod")')
param environmentName string

@description('Azure OpenAI model to deploy')
param openAiModelName string = 'gpt-5.1-chat'

@description('Azure OpenAI model version')
param openAiModelVersion string = '2025-11-13'

@description('Azure OpenAI API version used by the app')
param openAiApiVersion string = '2025-04-01-preview'

@description('Capacity (in 1K TPM units) for the OpenAI deployment')
param openAiCapacity int = 10

@description('Name of the Static Web App')
param staticWebAppName string = 'swa-func-${environmentName}'

@description('Location for Static Web App (limited region support: westus2, centralus, eastus2, westeurope, eastasia)')
param staticWebAppLocation string = 'eastasia'

@description('Entra ID (AAD) app registration client ID. Leave empty to use built-in auth.')
param aadClientId string = ''

@secure()
@description('Entra ID (AAD) app registration client secret. Leave empty to use built-in auth.')
param aadClientSecret string = ''

// ──────── Names ────────
var uniqueSuffix = uniqueString(resourceGroup().id)
var openAiAccountName = 'aoai-${environmentName}-${uniqueSuffix}'
var openAiDeploymentName = openAiModelName

// ──────── Azure OpenAI ────────
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiAccountName
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAiAccountName
    publicNetworkAccess: 'Enabled'
  }
}

resource openAiDeployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: openAiDeploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: openAiCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: openAiModelName
      version: openAiModelVersion
    }
  }
}

// ──────── Static Web App ────────
resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticWebAppName
  location: staticWebAppLocation
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    repositoryUrl: 'https://github.com/Xilorole/simple-spa-with-function'
    branch: 'main'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    provider: 'GitHub'
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

resource staticWebAppBasicAuth 'Microsoft.Web/staticSites/basicAuth@2024-11-01' = {
  parent: staticWebApp
  name: 'default'
  properties: {
    applicableEnvironmentsMode: 'SpecifiedEnvironments'
  }
}

// ──────── App Settings (environment variables for the Functions API) ────────
var baseAppSettings = {
  AZURE_OPENAI_ENDPOINT: openAi.properties.endpoint
  AZURE_OPENAI_API_KEY: openAi.listKeys().key1
  AZURE_OPENAI_DEPLOYMENT: openAiDeployment.name
  AZURE_OPENAI_API_VERSION: openAiApiVersion
}

var aadAppSettings = !empty(aadClientId)
  ? {
      AZURE_AD_CLIENT_ID: aadClientId
      AZURE_AD_CLIENT_SECRET: aadClientSecret
    }
  : {}

resource swaAppSettings 'Microsoft.Web/staticSites/config@2024-11-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: union(baseAppSettings, aadAppSettings)
}

// ──────── Outputs ────────
output staticWebAppName string = staticWebApp.name
output staticWebAppDefaultHostname string = staticWebApp.properties.defaultHostname
output staticWebAppId string = staticWebApp.id
output openAiEndpoint string = openAi.properties.endpoint
output openAiAccountName string = openAi.name
