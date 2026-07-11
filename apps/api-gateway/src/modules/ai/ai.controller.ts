import {
  Controller, Post, Get, Delete, Body, Param, Query, UseGuards,
  HttpCode, HttpStatus, Res, Sse,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';
import { Throttle } from '@nestjs/throttler';
import { IsString, IsOptional, MaxLength, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ChatDto {
  @ApiProperty({ example: 'What are my most critical vulnerabilities?' })
  @IsString()
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ description: 'Existing conversation ID to continue' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'Context type (vulnerability, scan, asset, etc.)' })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({ description: 'Context entity ID' })
  @IsOptional()
  @IsUUID()
  contextId?: string;

  @ApiPropertyOptional({ enum: ['OPENAI', 'ANTHROPIC', 'OLLAMA'] })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ example: 'gpt-4o' })
  @IsOptional()
  @IsString()
  model?: string;
}

@ApiTags('AI Copilot')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to the AI Security Copilot', operationId: 'aiChat' })
  @ApiResponse({ status: 200, description: 'AI response generated successfully' })
  async chat(
    @Body() dto: ChatDto,
    @CurrentUser() user: AuthContext,
  ) {
    return this.aiService.chat(dto, user);
  }

  @Post('chat/stream')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Stream AI response using SSE', operationId: 'aiChatStream' })
  async chatStream(
    @Body() dto: ChatDto,
    @CurrentUser() user: AuthContext,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      for await (const chunk of this.aiService.chatStream(dto, user)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.isComplete) break;
      }
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('analyze/vulnerability/:id')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.VULNS_VIEW)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'AI-powered vulnerability analysis', operationId: 'analyzeVulnerability' })
  async analyzeVulnerability(
    @Param('id') vulnerabilityId: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.aiService.analyzeVulnerability(vulnerabilityId, user);
  }

  @Post('analyze/scan/:id/summary')
  @RequirePermissions(PERMISSIONS.AI_USE, PERMISSIONS.SCANS_VIEW)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate AI scan summary', operationId: 'generateScanSummary' })
  async generateScanSummary(
    @Param('id') scanId: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.aiService.generateScanSummary(scanId, user);
  }

  @Get('conversations')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'List AI conversations', operationId: 'listConversations' })
  async listConversations(@CurrentUser() user: AuthContext) {
    return this.aiService.listConversations(user);
  }

  @Get('conversations/:id')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Get conversation with messages', operationId: 'getConversation' })
  async getConversation(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthContext,
  ) {
    return this.aiService.getConversation(conversationId, user);
  }

  @Delete('conversations/:id')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a conversation', operationId: 'deleteConversation' })
  async deleteConversation(
    @Param('id') conversationId: string,
    @CurrentUser() user: AuthContext,
  ) {
    await this.aiService.deleteConversation(conversationId, user);
  }

  @Get('models')
  @RequirePermissions(PERMISSIONS.AI_USE)
  @ApiOperation({ summary: 'Get available AI models', operationId: 'getAvailableModels' })
  async getModels(@CurrentUser() user: AuthContext) {
    return this.aiService.getAvailableModels(user);
  }
}
