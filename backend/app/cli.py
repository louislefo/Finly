import argparse
import uuid
import sys
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import hash_user_password

def create_admin(email: str, password: str, name: str):
    db = SessionLocal()
    try:
        clean_email = email.lower().strip()
        user = db.query(User).filter(User.email == clean_email).first()
        if user:
            user.role = "admin"
            user.is_active = True
            user.hashed_password = hash_user_password(password)
            if name:
                user.full_name = name.strip()
            db.commit()
            print(f"[Admin CLI] Utilisateur existant '{clean_email}' mis a jour en Administrateur.")
            return

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        new_user = User(
            id=user_id,
            email=clean_email,
            full_name=name.strip() if name else "Administrateur",
            hashed_password=hash_user_password(password),
            role="admin",
            is_active=True,
        )
        db.add(new_user)
        db.commit()
        print(f"[Admin CLI] Administrateur '{clean_email}' cree avec succes (ID: {user_id}).")
    except Exception as e:
        db.rollback()
        print(f"[Admin CLI Error] {e}")
        sys.exit(1)
    finally:
        db.close()

def promote_admin(email: str):
    db = SessionLocal()
    try:
        clean_email = email.lower().strip()
        user = db.query(User).filter(User.email == clean_email).first()
        if not user:
            print(f"[Admin CLI Error] Aucun utilisateur trouve avec l'email '{clean_email}'.")
            sys.exit(1)
        user.role = "admin"
        user.is_active = True
        db.commit()
        print(f"[Admin CLI] Utilisateur '{clean_email}' promu au role 'admin' avec succes.")
    except Exception as e:
        db.rollback()
        print(f"[Admin CLI Error] {e}")
        sys.exit(1)
    finally:
        db.close()

def list_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"\nTotal utilisateurs: {len(users)}")
        print("-" * 75)
        print(f"{'ID':<18} | {'Email':<28} | {'Role':<8} | {'Actif':<6} | {'Nom'}")
        print("-" * 75)
        for u in users:
            is_active = getattr(u, "is_active", True)
            print(f"{u.id:<18} | {u.email:<28} | {u.role:<8} | {str(is_active):<6} | {u.full_name}")
        print("-" * 75 + "\n")
    except Exception as e:
        print(f"[Admin CLI Error] {e}")
        sys.exit(1)
    finally:
        db.close()

def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        clean_email = email.lower().strip()
        user = db.query(User).filter(User.email == clean_email).first()
        if not user:
            print(f"[Admin CLI Error] Aucun utilisateur trouve avec l'email '{clean_email}'.")
            sys.exit(1)
        user.hashed_password = hash_user_password(new_password)
        db.commit()
        print(f"[Admin CLI] Mot de passe de '{clean_email}' reinitialise avec succes.")
    except Exception as e:
        db.rollback()
        print(f"[Admin CLI Error] {e}")
        sys.exit(1)
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description="Finly Admin Management CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-admin
    create_parser = subparsers.add_parser("create-admin", help="Creer un nouvel administrateur")
    create_parser.add_argument("--email", required=True, help="Email de l'administrateur")
    create_parser.add_argument("--password", required=True, help="Mot de passe")
    create_parser.add_argument("--name", default="Administrateur", help="Nom complet")

    # promote-admin
    promote_parser = subparsers.add_parser("promote-admin", help="Promouvoir un utilisateur existant en admin")
    promote_parser.add_argument("--email", required=True, help="Email de l'utilisateur a promouvoir")

    # list-users
    subparsers.add_parser("list-users", help="Lister tous les utilisateurs")

    # reset-password
    reset_parser = subparsers.add_parser("reset-password", help="Reinitialiser le mot de passe d'un utilisateur")
    reset_parser.add_argument("--email", required=True, help="Email de l'utilisateur")
    reset_parser.add_argument("--password", required=True, help="Nouveau mot de passe")

    args = parser.parse_args()

    if args.command == "create-admin":
        create_admin(args.email, args.password, args.name)
    elif args.command == "promote-admin":
        promote_admin(args.email)
    elif args.command == "list-users":
        list_users()
    elif args.command == "reset-password":
        reset_password(args.email, args.password)

if __name__ == "__main__":
    main()
