import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeriesGenerator } from './entities/series-generator.entity';
import { SeriesGeneratorService } from './series-generator.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SeriesGenerator])],
  providers: [SeriesGeneratorService],
  exports: [SeriesGeneratorService],
})
export class SeriesGeneratorModule {}
