import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions'

/**
 * Assemble Z80 code using RASM
 *
 * For now, this is a placeholder that will be implemented
 */
export const handler: Handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const { code } = JSON.parse(event.body || '{}')

    if (!code) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No Z80 code provided' })
      }
    }

    // Execute RASM here
    // const assembled = await rasm.assemble(code);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'RASM integration coming soon'
      })
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Assembly failed',
        details: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
