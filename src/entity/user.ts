import { Entity, Column, PrimaryGeneratedColumn, Repository, getManager } from 'typeorm';
import { Length, IsEmail, validate, ValidationError } from 'class-validator';

class BaseEntity {
    constructor(object?: Object) {
        if (object) {
            Object.entries(object).forEach(([key, value]) => {
                // 如果属性在定义的时候，并没有通过等号进行赋值，无法通过in检测是否包含此属性；
                this[key] = value;
            });
        }
    }

    static getRepository(): Repository<any> {
        return getManager().getRepository(this);
    }

    async validate(): Promise<ValidationError[]> {
        return await validate(this, {skipMissingProperties: true});
    }
}

@Entity()
export class User extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 80})
    @Length(2, 80)
    name: string;

    @Column({length: 100, nullable: true})
    @Length(2, 100)
    @IsEmail()
    email: string;

    @Column({length: 100})
    @Length(2, 100)
    password: string;
}

export const userSchema = {
    id: {type: 'number', required: false, example: 1, description: '用户id'},
    name: {type: 'string', required: true, example: 'Javier', default: 11, description: '用户名'},
    email: {type: 'string', required: false, example: 'avileslopez.javier@gmail.com'},
    password: {type: 'string', required: true, example: 'avileslopez.javier@gmail.com'}
};