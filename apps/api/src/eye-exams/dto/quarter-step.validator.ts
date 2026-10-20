import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

export function IsQuarterStep(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isQuarterStep',
      target: object.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'number' && Number.isFinite(value) && Math.abs(value * 4 - Math.round(value * 4)) < 1e-8;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} phải theo bước 0.25.`;
        },
      },
    });
  };
}
