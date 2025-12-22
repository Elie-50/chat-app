import {
	Controller,
	Get,
	Post,
	Body,
	Patch,
	Param,
	UseGuards,
	Req,
	Query,
	HttpCode,
	HttpStatus,
	Delete,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { type AuthenticatedRequest, AuthGuard } from '../auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/conversations')
export class ConversationsController {
	constructor(private readonly conversationsService: ConversationsService) {}

	@HttpCode(HttpStatus.CREATED)
	@Post()
	create(@Req() req: AuthenticatedRequest, @Body() body: { name: string }) {
		return this.conversationsService.create(req.user!._id, body.name);
	}

	@HttpCode(HttpStatus.OK)
	@Get()
	findAll(
		@Req() req: AuthenticatedRequest,
		@Query('page') page = 1,
		@Query('size') size = 20,
	) {
		return this.conversationsService.findAll(req.user!._id, page, size);
	}

	@HttpCode(HttpStatus.OK)
	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.conversationsService.findOne(id);
	}

	@HttpCode(HttpStatus.OK)
	@Patch(':id')
	update(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: { name: string },
	) {
		return this.conversationsService.update(id, req.user!._id, body.name);
	}

	@HttpCode(HttpStatus.CREATED)
	@Post('members')
	addMember(
		@Req() req: AuthenticatedRequest,
		@Body() body: { memberId: string; conversationId: string },
	) {
		return this.conversationsService.addMember(
			body.memberId,
			req.user!._id,
			body.conversationId,
		);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':conversationId/members/:memberId')
	removeMember(
		@Req() req: AuthenticatedRequest,
		@Param('conversationId') conversationId: string,
		@Param('memberId') memberId: string,
	) {
		return this.conversationsService.removeMember(
			memberId,
			req.user!._id,
			conversationId,
		);
	}
}
