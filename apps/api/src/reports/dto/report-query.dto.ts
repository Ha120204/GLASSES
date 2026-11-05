import { IsOptional, ValidateBy, isDateString } from 'class-validator';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const IsReportDay = (message: string): PropertyDecorator => ValidateBy({
  name: 'isReportDay',
  validator: {
    validate: (value: unknown): boolean => typeof value === 'string'
      && dateOnlyPattern.test(value)
      && isDateString(value, { strict: true, strictSeparator: true }),
  },
}, { message });

export class ReportQueryDto {
  @IsOptional()
  @IsReportDay('Ngày bắt đầu không hợp lệ.')
  dateFrom?: string;

  @IsOptional()
  @IsReportDay('Ngày kết thúc không hợp lệ.')
  dateTo?: string;
}
