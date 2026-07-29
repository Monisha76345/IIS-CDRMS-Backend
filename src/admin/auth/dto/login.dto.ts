import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: 'Login ID must be a valid string' })
  @IsNotEmpty({ message: 'Login ID is required' })
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}
