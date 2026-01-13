import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { v1 } from '@google-cloud/discoveryengine';

const projectId = process.env.GOOGLE_PROJECT_ID!;
const dataStoreId = process.env.VERTEX_AI_DATA_STORE_ID!;
const location = 'global'; // Discovery Engine location
const aiLocation = 'us-central1'; // Vertex AI location

// Credentials for Vercel (or local .env)
const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const authOptions = clientEmail && privateKey ? {
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    }
} : {};

// Lazy Injectors
let vertexAI: VertexAI;
let model: GenerativeModel;
let searchClient: v1.SearchServiceClient;
let documentClient: v1.DocumentServiceClient;

function getModel() {
    if (!model) {
        vertexAI = new VertexAI({
            project: projectId,
            location: aiLocation,
            googleAuthOptions: authOptions
        });
        model = vertexAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    }
    return model;
}

function getSearchClient() {
    if (!searchClient) {
        if (!searchClient) {
            searchClient = new v1.SearchServiceClient(authOptions);
        }
    }
    return searchClient;
}

function getDocumentClient() {
    if (!documentClient) {
        if (!documentClient) {
            documentClient = new v1.DocumentServiceClient(authOptions);
        }
    }
    return documentClient;
}

interface SearchResult {
    title: string;
    uri: string;
    snippet: string;
}

import { Storage } from '@google-cloud/storage';

// ... (existing imports)

// ... (existing clients)

function getStorage() {
    return new Storage({
        projectId: projectId,
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
    });
}

export async function importDocuments(gcsUri: string) {
    const client = getDocumentClient();
    const parent = client.projectLocationCollectionDataStoreBranchPath(
        projectId,
        location,
        'default_collection',
        dataStoreId,
        'default_branch'
    );

    // If file is not JSONL/NDJSON, create a manifest
    let importUri = gcsUri;
    if (!gcsUri.endsWith('.jsonl') && !gcsUri.endsWith('.ndjson')) {
        console.log(`Creating import manifest for ${gcsUri}...`);
        try {
            const storage = getStorage();
            // Parse bucket and path from gs://bucket/path
            const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
            if (match) {
                const bucketName = match[1];
                const fileName = `manifests/import_${Date.now()}.jsonl`;
                const file = storage.bucket(bucketName).file(fileName);

                // Content: {"uri": "gs://..."}
                const manifestContent = JSON.stringify({ uri: gcsUri });

                await file.save(manifestContent);
                importUri = `gs://${bucketName}/${fileName}`;
                console.log(`Manifest created: ${importUri}`);
            }
        } catch (error) {
            console.error('Failed to create manifest, falling back to direct URI:', error);
        }
    }

    console.log(`Triggering import for ${importUri} to ${parent}`);

    const [response] = await client.importDocuments({
        parent,
        gcsSource: {
            inputUris: [importUri],
            dataSchema: 'document', // For JSONL manifest, 'document' schema tells it to read document metadata/uri from json
        },
        reconciliationMode: 'INCREMENTAL',
    });

    return response;
}

export async function generateAnswer(question: string): Promise<string> {
    const client = getSearchClient();
    const genModel = getModel();

    // 1. Search Knowledge Base
    console.log(`Searching for: ${question}`);
    try {
        const searchResponse = await client.search({
            servingConfig: client.projectLocationCollectionDataStoreServingConfigPath(
                projectId,
                location,
                'default_collection',
                dataStoreId,
                'default_search'
            ),
            query: question,
            pageSize: 10,
            contentSearchSpec: {
                snippetSpec: { returnSnippet: true },
            },
            summarySpec: {
                summaryResultCount: 5,
                includeCitations: true,
                ignoreAdversarialQuery: true,
                modelSpec: { version: 'stable' },
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any); // Cast to any because TS definition might be missing summarySpec in this version

        const results: SearchResult[] = [];
        // searchResponse[0] is the results array or the full response depending on destructuring. 
        // Based on previous logs: searchResponse[0] was the result array.
        // But summary is usually in the response object.
        // Let's check the return type of client.search. It usually returns [results, request, response].

        let discoverySummary = '';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (searchResponse[2] && (searchResponse[2] as any).summary) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            discoverySummary = (searchResponse[2] as any).summary.summaryText || '';
        }

        const searchResults = searchResponse[0];

        if (searchResults) {
            console.log(`Found ${searchResults.length} search results via Discovery Engine.`);


            for (const result of searchResults) {
                const data = result.document?.derivedStructData?.fields;
                if (data) {
                    // Try to find content in other fields if snippet is empty
                    let content = '';

                    // 1. Try snippets (Deeply nested structure)
                    if (data.snippets?.listValue?.values?.[0]?.structValue?.fields?.snippet?.stringValue) {
                        content = data.snippets.listValue.values[0].structValue.fields.snippet.stringValue;
                    }
                    // Fallback for simple string snippets (if schema changes)
                    else if (data.snippets?.listValue?.values?.[0]?.stringValue) {
                        content = data.snippets.listValue.values[0].stringValue;
                    }

                    // 2. Try extractive_segments (fallback)

                    // 2. Try extractive_segments (fallback)
                    if (!content && data.extractive_segments?.listValue?.values?.[0]?.structValue?.fields?.content?.stringValue) {
                        content = data.extractive_segments.listValue.values[0].structValue.fields.content.stringValue;
                    }

                    // 3. Try snippets (singular? rare but checking)
                    if (!content && data.snippet?.stringValue) {
                        content = data.snippet.stringValue;
                    }

                    results.push({
                        title: data.title?.stringValue || 'Untitled',
                        uri: data.link?.stringValue || '',
                        snippet: content,
                    });
                }
            }
        } else {
            console.log('No search results found via Discovery Engine.');
        }

        // 2. Filter & Split (Canon vs Theory)
        const scriptDocs = results.filter((r) => r.uri.includes('/work/'));
        const knowledgeDocs = results.filter((r) => !r.uri.includes('/work/'));

        console.log(`Context: ${scriptDocs.length} script docs, ${knowledgeDocs.length} knowledge docs.`);

        // 3. Construct Context
        const scriptContext = scriptDocs
            .map((doc) => `Source: ${doc.title}\nContent: ${doc.snippet}`)
            .join('\n\n');

        const knowledgeContext = knowledgeDocs
            .map((doc) => `Source: ${doc.title}\nContent: ${doc.snippet}`)
            .join('\n\n');



        const systemPrompt = `
You are a Drama Assistant Writer (StoryAI Helper).
Your goal is to assist the content creator by providing better ideas and analyzing their work.

[Context Hierarchy]
0. SUMMARY (Generated by Search Engine):
${discoverySummary ? discoverySummary : '(No summary available)'}

1. CANON (Absolute Fact): The user's own scripts/treatments.
${scriptContext ? scriptContext : '(No scripts found relating to this query)'}

2. THEORY (Reference): Writing theories and background knowledge.
${knowledgeContext ? knowledgeContext : '(No theory found relating to this query)'}

Answer the user's question "${question}" based on the above context.
Prioritize CANON over THEORY.
The SUMMARY is a high-level overview generated from the documents. Use it to ensure you don't miss key entities, but prefer specific details from CANON snippets if available.

**IMPORTANT RULES:**
1. **ALWAYS RESPOND IN KOREAN.** (The user is Korean).
2. If the context contains relevant information, cite the source title.
3. If you simply cannot find the answer in the context, admit it politely in Korean and suggest general advice.
      `;

        // 4. Generate Answer
        const result = await genModel.generateContent(systemPrompt);
        const response = await result.response;
        // Accessing text safely
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        return part?.text || '답변을 생성하지 못했습니다.';
    } catch (e) {
        console.error('Vertex AI Error:', e);
        throw e;
    }
}
