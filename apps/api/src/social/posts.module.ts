import { Module, forwardRef } from '@nestjs/common'
import { PostsService } from './posts.service'
import { TrackingModule } from '../tracking/tracking.module'
import { AdminModule } from '../admin/admin.module'

/**
 * PostsService vive em módulo próprio porque é usado dos dois lados: pelo
 * módulo social (a pessoa publica) e pelo painel (o administrador modera).
 * Sem esta separação, social e admin importariam um ao outro em círculo.
 */
@Module({
  imports: [TrackingModule, forwardRef(() => AdminModule)],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
