import { ValidationTypes, ValidationArguments } from 'class-validator';

export function patchClassValidatorI18n() {
    const orig = ValidationTypes.getMessage.bind(ValidationTypes);
    ValidationTypes.getMessage = function (type: string, isEach: boolean): string | ((args: ValidationArguments) => string) {

        switch (type) {
            case ValidationTypes.LENGTH:
                return function (args) {
                    const isMinLength = args.constraints[0] !== null && args.constraints[0] !== undefined;
                    const isMaxLength = args.constraints[1] !== null && args.constraints[1] !== undefined;
                    if (isMinLength && (!args.value || args.value.length < args.constraints[0]))
                        return '$property $value $target 长度必须大于等于 $constraint1！';

                    if (isMaxLength && (args.value.length > args.constraints[1]))
                        return '$property 长度必须小于等于  $constraint2！';
                    return '$property 长度必须大于等于 $constraint1 并且小于等于 $constraint2';
                };
            // return the original (English) message from class-validator when a type is not handled
            default:
                return orig(type, isEach);
        }
    };
}