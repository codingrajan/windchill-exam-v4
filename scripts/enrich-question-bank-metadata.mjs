import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'public', 'data');
const files = fs.readdirSync(dataDir).filter((file) => /^windchill_mock_test_.*\.json$/.test(file)).sort();

const MANUALS = {
  technical: 'Windchill Technical Essentials course manual.pdf',
  advanced: 'Windchill Advanced Configuration course manual.pdf',
};

const has = (text, pattern) => pattern.test(text);
const buildClassifyText = (question) => `${question.question || ''} ${question.explanation || ''}`.trim();
const buildReferenceText = (question) => `${question.question || ''} ${question.objective || ''} ${question.explanation || ''}`;

const inferDomain = (question) => {
  const text = buildClassifyText(question);

  if (has(text, /Navigate|ThingWorx|Windchill REST Services/i)) return 'Navigate and Role-Based Consumption';
  if (has(text, /project plan|milestones|deliverables|context creators|site-level preferences|product-level preference|organization default|preference modification|Searching preference|Tables preference|Package business administration configurations|templates important when creating new contexts|template pick list|preference hierarchy|locked preference|user-level preference|Content preference category|Display preference category|setting Windchill preferences|context levels|locked versus locally modifiable/i)) return 'Contexts, Preferences, and Business Administration';
  if (has(text, /security auditing reports|usage report|usage reporting|Performance Advisor|WAN accelerator|report-based view of system behavior|replicated content/i)) return 'System Administration, Vaulting, and Performance';
  if (has(text, /worker host|publish job|background publishing|synchronous conversion|check(?:ing)? in only a top-level CAD file|dependencies|authoring file type|manual republish|browser viewable|publish failure|publish-rule design|viewable-distribution strategy/i)) return 'CAD Data Management and Visualization';
  if (has(text, /Collect Objects step|move operation help prevent|move with an object when collected appropriately/i)) return 'System Administration, Vaulting, and Performance';
  if (has(text, /focused app experiences/i)) return 'Navigate and Role-Based Consumption';
  if (has(text, /private domain architecture|actor\b.*role resolution|actor in the context of team template role resolution/i)) return 'Access Control, Teams, and Security';
  if (has(text, /Review and Audit stage|review and audit change|issue capture|change evaluation|change execution|change-management job|release through change|Problem Report|Change Request|Change Notice|Change Task|Variance/i)) return 'Change and Release Management';
  if (has(text, /document structure|product structure|quantity typically interpreted/i)) return 'Configuration Management and Product Structures';
  if (has(text, /EPMDocument|WTPart|WTDocumentMaster|WTDocument\b|primary content|secondary content|owner association|image association|content association|described by|reference link|master object/i)) return 'Data Model, Types, and Attributes';
  if (has(text, /workspace|check out|checkout|check in|check-in|workgroup manager|CAD document|CAD-centric|Creo|representation|WVS|publish rule|Creo View|drawing|assembly|visualization|commonspace|out-of-date|authoring application/i)) return 'CAD Data Management and Visualization';
  if (has(text, /multi-tiered configuration|monolithic|Apache web server|application tier|client environment|initialize properly|services must be started|database tier|method server|directory server|clustered architecture|single server|web server/i)) return 'Architecture, Installation, and Integration';
  if (has(text, /routine Windchill administrative maintenance|administrative maintenance|site\.xconf|xconfmanager|queue|backup|vault|rehost|replication|replica server|audit report|usage reporting|throughput|WCA|Move Wizard|SCC|windchill shell|cache sizes|heap sizes|JMX|WContentVerify|hot backup/i)) return 'System Administration, Vaulting, and Performance';
  if (has(text, /profile\b|Functional Definition Document|FDD|configuration driver|business configuration requirements|subscriber checkbox|Restricted Directory Search|organization context|program context|project context|library context|product context|context hierarchy|context template|Add Roles to Organization/i)) return 'Contexts, Preferences, and Business Administration';
  if (has(text, /baseline|configuration specification|effectivity|occurrence|Where Used|Latest Released|Latest configuration specification|maturity baseline|serial number|lot number|calendar date/i)) return 'Configuration Management and Product Structures';
  if (has(text, /Lock' life cycle transition|Change' transition type|transition type|Set State|combined use of workflows and user actions|Production Released|Obsolescence/i)) return 'Lifecycle, Workflow, and Object Initialization';
  if (has(text, /change request|change notice|problem report|variance|change task|promotion request|promotion process|redline|change management process|Identify Need|Investigate Need|Change Planning|Review and Audit Change|concurrent changes|Change Review Board|release through change/i)) return 'Change and Release Management';
  if (has(text, /Object Initialization Rule|\bOIRs?\b|FolderPathAttributeAlgorithm|LifeCycleTemplateAttributeAlgorithm|TeamTemplateAttributeAlgorithm|VersionSchemeAttributeAlgorithm|NumberingAttributeAlgorithm|default folder location|auto-numbering/i)) return 'Lifecycle, Workflow, and Object Initialization';
  if (has(text, /access control|Policy Administration|domain policies|context groups|context roles|participants|shared team|administrative deny|absolute deny|policy administrator|profile|role-to-role mapping/i)) return 'Access Control, Teams, and Security';
  if (has(text, /life cycle|workflow|Available for Routing|state-based versioning|state based versioning|version series|transition type|combined use of workflows/i)) return 'Lifecycle, Workflow, and Object Initialization';
  if (has(text, /WTObject|parent class|reusable attribute|global attribute|local attribute|alias attribute|enumeration|constraint|subtype|type and attribute|layout|attribute/i)) return 'Data Model, Types, and Attributes';
  if (has(text, /tiered application architecture|application architecture|client application|test server|single username and password|full-text search|indexing server|PSI|installation|ERP system|authenticates Windchill users/i)) return 'Architecture, Installation, and Integration';
  if (has(text, /PLM|digital thread|part-centric|part centric|legacy data|closed-loop quality|closed loop quality|business value|implementation best practices/i)) return 'PLM Strategy and Foundations';

  return 'PLM Strategy and Foundations';
};

const inferObjective = (question, domain) => {
  const text = buildClassifyText(question);

  if (domain === 'PLM Strategy and Foundations') {
    if (has(text, /digital thread|ERP|manufacturing|quality|closed-loop quality|closed loop quality|EBOM|MBOM/i)) return 'PLM Value and Digital Thread';
    if (has(text, /part-centric|part centric|CAD data and parts|product development/i)) return 'Part-Centric Strategy and Adoption';
    if (has(text, /legacy data|implementation best practices|recommended best practices/i)) return 'Implementation Strategy and Legacy Data';
    return 'PLM Concepts and Business Value';
  }

  if (domain === 'Architecture, Installation, and Integration') {
    if (has(text, /installation|PSI|single server|clustered architecture|Database Tier|application tier/i)) return 'Installation and Deployment Topology';
    if (has(text, /ERP|directory server|authentication|single username and password/i)) return 'Enterprise Integration and Authentication';
    if (has(text, /Apache web server|client environment|web server/i)) return 'Client Access and Web Tier';
    return 'Core Architecture and Services';
  }

  if (domain === 'Contexts, Preferences, and Business Administration') {
    if (has(text, /preference/i)) return 'Preferences';
    if (has(text, /profile/i)) return 'Profiles and Business Administration';
    if (has(text, /context template/i)) return 'Context Templates';
    if (has(text, /Functional Definition Document|FDD|configuration driver/i)) return 'Business Analysis and Configuration Planning';
    if (has(text, /organization|subscriber|Restricted Directory Search/i)) return 'Organization Setup and Directory Controls';
    return 'Context Hierarchy and Application Contexts';
  }

  if (domain === 'Data Model, Types, and Attributes') {
    if (has(text, /EPMDocument|WTPart|WTDocumentMaster|WTDocument\b|owner association|image association|content association|described by|reference link|master object|primary content|secondary content/i)) return 'Core Object Model and Associations';
    if (has(text, /layout/i)) return 'Layouts and Attribute Presentation';
    if (has(text, /constraint|enumeration|Legal Value Set|Suggested Value Set|External Enumerated Value List|Cascading Attribute/i)) return 'Constraints and Enumerations';
    if (has(text, /reusable attribute|global attribute|local attribute|alias attribute|formula|modeled attribute|attribute/i)) return 'Attribute Modeling and Reuse';
    return 'Type Inheritance and Class Hierarchy';
  }

  if (domain === 'Lifecycle, Workflow, and Object Initialization') {
    if (has(text, /Object Initialization Rule|\bOIRs?\b|FolderPathAttributeAlgorithm|LifeCycleTemplateAttributeAlgorithm|TeamTemplateAttributeAlgorithm|VersionSchemeAttributeAlgorithm|NumberingAttributeAlgorithm|auto-numbering|default folder/i)) return 'Object Initialization Rules';
    if (has(text, /workflow/i)) return 'Workflow Design and Execution';
    if (has(text, /state-based versioning|state based versioning|version series|version/i)) return 'Versioning and Revision Rules';
    return 'Life Cycle Templates and States';
  }

  if (domain === 'Access Control, Teams, and Security') {
    if (has(text, /policy administrator|ACL|absolute deny|administrative deny|domain policies|access control|life cycle access control/i)) return 'Policy Administration and Access Evaluation';
    if (has(text, /team|participants|shared team|context roles|context groups|role-to-role mapping/i)) return 'Teams, Roles, and Context Groups';
    return 'Security Administration and Audit Controls';
  }

  if (domain === 'Change and Release Management') {
    if (has(text, /Problem Report|Variance/i)) return 'Issue Intake and Variance Control';
    if (has(text, /Change Review Board|Review and Audit|role resolution|context roles/i)) return 'Change Governance and Review';
    if (has(text, /Change Request|Change Notice/i)) return 'Change Requests and Notices';
    if (has(text, /promotion request|Production Released|Obsolescence|promotion scheme|promotion workflow/i)) return 'Promotion Requests and Release Paths';
    if (has(text, /redline|affected objects|resulting objects|change task|concurrent changes|sequencing Change Tasks|designated assignees/i)) return 'Change Execution and Resulting Objects';
    return 'Change Requests and Notices';
  }

  if (domain === 'Configuration Management and Product Structures') {
    if (has(text, /baseline|maturity baseline/i)) return 'Baselines and Structure Snapshots';
    if (has(text, /effectivity|serial number|lot number|calendar date|cutover date/i)) return 'Effectivity and Applicability';
    if (has(text, /occurrence|usage level|quantity|Where Used|document structure/i)) return 'Structure Usage and Navigation';
    return 'Configuration Specifications and Filters';
  }

  if (domain === 'CAD Data Management and Visualization') {
    if (has(text, /WVS|representation|publish rule|CAD worker|Creo View|visualization/i)) return 'Visualization and Publishing';
    if (has(text, /workspace|commonspace|check out|checkout|check in|check-in|out-of-date/i)) return 'Workspaces and Commonspace Control';
    return 'CAD Documents and Authoring Context';
  }

  if (domain === 'System Administration, Vaulting, and Performance') {
    if (has(text, /replication|replica server|content replication/i)) return 'Replication and Distribution';
    if (has(text, /audit|usage reporting|throughput/i)) return 'Audit and Usage Reporting';
    if (has(text, /backup|vault|rehost/i)) return 'Backup, Vaulting, and Rehost';
    if (has(text, /queue|Move Wizard|WCA|windchill shell|xconfmanager|JMX|SCC/i)) return 'Administrative Utilities and Queues';
    if (has(text, /maintenance/i)) return 'Operational Maintenance';
    return 'Performance and Runtime Administration';
  }

  if (domain === 'Navigate and Role-Based Consumption') {
    if (has(text, /ThingWorx|REST Services|architecture/i)) return 'Navigate Architecture';
    if (has(text, /security|directory account|access/i)) return 'Navigate Security and Administration';
    return 'Navigate Fundamentals';
  }

  return String(question.objective || domain).trim();
};

const inferSourceManual = (domain, objective, referenceText) => {
  if (/Advanced Configuration manual/i.test(referenceText)) return MANUALS.advanced;
  if (/Technical Essentials manual/i.test(referenceText)) return MANUALS.technical;

  if (
    domain === 'Data Model, Types, and Attributes' ||
    domain === 'Lifecycle, Workflow, and Object Initialization' ||
    domain === 'Access Control, Teams, and Security'
  ) {
    return MANUALS.advanced;
  }

  if (domain === 'Contexts, Preferences, and Business Administration' && /Preferences|Profiles|Context Templates/i.test(objective)) {
    return MANUALS.advanced;
  }

  if (domain === 'Change and Release Management' && /Promotion Requests and Release Paths/i.test(objective)) {
    return MANUALS.advanced;
  }

  if (/promotion request|change notice|advanced life cycle/i.test(referenceText)) {
    return MANUALS.advanced;
  }

  return MANUALS.technical;
};

const inferMisconceptionTag = (domain, objective, text) => {
  if (domain === 'Lifecycle, Workflow, and Object Initialization' && /Object Initialization Rule|\bOIRs?\b/i.test(text) && /site level|organization level|product level|override|precedence|existing objects|new objects/i.test(text)) {
    return 'OIR scope and override precedence';
  }
  if (domain === 'Lifecycle, Workflow, and Object Initialization' && /Object Initialization Rule|\bOIRs?\b/i.test(text)) {
    return 'OIR algorithm purpose confusion';
  }
  if (domain === 'Access Control, Teams, and Security') {
    return /Teams|Roles|Context Groups/i.test(objective) ? 'Team membership and role-resolution confusion' : 'Access evaluation and deny-rule confusion';
  }
  if (domain === 'Data Model, Types, and Attributes') {
    if (/Core Object Model and Associations/i.test(objective)) return 'Object association and master-object confusion';
    if (/Constraints and Enumerations/i.test(objective)) return 'Constraint behavior and enumeration-scope confusion';
    return 'Attribute modeling and inheritance confusion';
  }
  if (domain === 'Lifecycle, Workflow, and Object Initialization') {
    return 'Life cycle vs workflow confusion';
  }
  if (domain === 'Change and Release Management') {
    if (/Promotion Requests and Release Paths/i.test(objective)) return 'Promotion request vs change notice confusion';
    return 'Change object role and stage confusion';
  }
  if (domain === 'Configuration Management and Product Structures') {
    if (/Effectivity and Applicability/i.test(objective)) return 'Effectivity and applicability confusion';
    if (/Structure Usage and Navigation/i.test(objective)) return 'Usage link, occurrence, and navigation confusion';
    return 'Configuration filtering vs structure definition';
  }
  if (domain === 'CAD Data Management and Visualization') {
    return /Visualization/i.test(objective) ? 'Visualization pipeline role confusion' : 'Workspace vs commonspace authority';
  }
  if (domain === 'System Administration, Vaulting, and Performance') {
    if (/Audit and Usage Reporting/i.test(objective)) return 'Audit reporting vs operational monitoring confusion';
    return /Replication/i.test(objective) ? 'Replication vs vaulting misconception' : 'Administration utility purpose confusion';
  }
  if (domain === 'Architecture, Installation, and Integration') {
    return /Integration|Authentication/i.test(objective) ? 'Integration-point and authentication-role confusion' : 'Architecture component role confusion';
  }
  if (domain === 'Contexts, Preferences, and Business Administration') {
    if (/Preferences|Profiles|Context Templates/i.test(objective)) return 'Preference, profile, and inheritance confusion';
    if (/Business Analysis/i.test(objective)) return 'Implementation-document vs runtime-configuration confusion';
    return 'Context hierarchy and organization-scope confusion';
  }
  if (domain === 'Navigate and Role-Based Consumption') {
    return 'Navigate architecture and scope';
  }
  return 'Terminology and solution-scope confusion';
};

for (const file of files) {
  const filePath = path.join(dataDir, file);
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const enriched = questions.map((question) => {
    const domain = inferDomain(question);
    const objective = inferObjective(question, domain);
    const referenceText = buildReferenceText(question);
    const classifyText = buildClassifyText(question);

    return {
      ...question,
      domain,
      topic: objective,
      objective,
      sourceManual: inferSourceManual(domain, objective, referenceText),
      sourceSection: objective,
      misconceptionTag: inferMisconceptionTag(domain, objective, classifyText),
      releaseVersion: '2026.04',
    };
  });

  fs.writeFileSync(filePath, `${JSON.stringify(enriched, null, 2)}\n`, 'utf8');
}

console.log(`Enriched metadata in ${files.length} question-bank files.`);
