import { StreamChunk, MessageBlock } from '../types';

export class StreamParser {
    private buffer: string = '';
    private blocks: MessageBlock[] = [];
    private currentThinkingBlock: Extract<MessageBlock, { type: 'text' }> | null = null;
    private currentTextBlock: Extract<MessageBlock, { type: 'text' }> | null = null;

    processChunk(chunk: StreamChunk): MessageBlock[] {
        if (chunk.type === 'token') {
            this.buffer += chunk.content;
            this.processBuffer();
        } else if (chunk.type === 'tool_call') {
            // Legacy support for full tool_call
            this.finalizeCurrentBlocks();
            this.blocks.push({
                type: 'tool_call',
                name: chunk.name,
                args: chunk.args,
                id: chunk.id,
                rawArgs: JSON.stringify(chunk.args)
            });
        } else if (chunk.type === 'tool_call_chunk') {
            this.finalizeCurrentBlocks();
            let toolBlock = this.blocks.find(b => b.type === 'tool_call' && b.id === chunk.id);

            if (!toolBlock) {
                // New tool call starting
                // NOTE: First chunk should contain the name
                toolBlock = {
                    type: 'tool_call',
                    name: chunk.name || 'unknown_tool',
                    args: {},
                    id: chunk.id,
                    rawArgs: ''
                };
                this.blocks.push(toolBlock);
            }

            // Append args chunk if present
            if (chunk.args) {
                // Ensure rawArgs is initialized
                if (toolBlock.type === 'tool_call') {
                    if (!toolBlock.rawArgs) toolBlock.rawArgs = '';
                    toolBlock.rawArgs += chunk.args;

                    // Attempt to parse JSON (optional, or wait for result?)
                    // For now, let's try to parse if it looks like a complete object or just keep it raw
                    // It's often hard to parse partial JSON. State might stay "loading" effectively.
                    try {
                        // Very naive check, usually we'd use a robust partial parser
                        // Here we just ignore parse errors until it's valid
                        toolBlock.args = JSON.parse(toolBlock.rawArgs);
                    } catch (e) {
                        // ignore
                    }
                }
            }
        } else if (chunk.type === 'tool_result') {
            const toolBlock = this.blocks.find(b => b.type === 'tool_call' && b.id === chunk.id);
            if (toolBlock && toolBlock.type === 'tool_call') {
                toolBlock.result = chunk.result;
            }
        } else if (chunk.type === 'user_request') {
            this.finalizeCurrentBlocks();
            this.blocks.push({
                type: 'user_request',
                content: chunk.content
            });
        } else if (chunk.type === 'system') {
            this.finalizeCurrentBlocks();
            this.blocks.push({
                type: 'system',
                content: chunk.content
            });
        }
        return [...this.blocks];
    }

    private processBuffer() {
        let loop = true;
        while (loop) {
            loop = false;

            // Check for <thinking> start
            const thinkingStart = this.buffer.indexOf('<thinking>');
            if (thinkingStart !== -1) {
                // Text before <thinking> goes to currentTextBlock
                if (thinkingStart > 0) {
                    const text = this.buffer.substring(0, thinkingStart);
                    this.appendToTextBlock(text, false);
                }

                this.buffer = this.buffer.substring(thinkingStart + 10);
                this.currentThinkingBlock = { type: 'text', content: '', isThinking: true };
                this.blocks.push(this.currentThinkingBlock);
                // We consumed text, so loop again
                loop = true;
                continue;
            }

            // Check for </thinking> end
            const thinkingEnd = this.buffer.indexOf('</thinking>');
            if (thinkingEnd !== -1) {
                if (this.currentThinkingBlock) {
                    const text = this.buffer.substring(0, thinkingEnd);
                    this.currentThinkingBlock.content += text;
                    this.currentThinkingBlock = null; // Close thinking block
                }
                this.buffer = this.buffer.substring(thinkingEnd + 11);
                loop = true;
                continue;
            }
        }

        // Remaining buffer logic
        if (this.currentThinkingBlock) {
            // We are inside thinking
            this.currentThinkingBlock.content += this.buffer;
            this.buffer = '';
        } else {
            // We are in normal text
            this.appendToTextBlock(this.buffer, false);
            this.buffer = '';
        }
    }

    private appendToTextBlock(text: string, isThinking: boolean) {
        if (!text) return;

        // If we have a current text block, append to it
        if (this.currentTextBlock && !this.currentTextBlock.isThinking) {
            this.currentTextBlock.content += text;
        } else {
            // Create new text block
            this.currentTextBlock = { type: 'text', content: text, isThinking: false };
            this.blocks.push(this.currentTextBlock);
        }
    }

    private finalizeCurrentBlocks() {
        this.currentThinkingBlock = null;
        this.currentTextBlock = null;
    }
}
