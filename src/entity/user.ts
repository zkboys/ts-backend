import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { Length, IsEmail} from 'class-validator';

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({length: 80})
    @Length(10, 80)
    name: string;

    @Column({length: 100, nullable: true})
    @Length(10, 100)
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