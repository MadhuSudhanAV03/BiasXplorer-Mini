from flask import Flask, jsonify
from flask_smorest import Api
from flask_cors import CORS
from dotenv import load_dotenv

# Import all route Blueprints
from resources.upload_routes import blp as UploadBlueprint
from resources.preprocess_routes import blp as PreprocessBlueprint
from resources.bias_routes import blp as BiasBlueprint
from resources.report_routes import blp as ReportBlueprint
from resources.select_routes import blp as SelectBlueprint


def create_app():
    """Application factory for BiasXplorer API"""
    app = Flask(__name__)
    load_dotenv()

    # Flask-Smorest / OpenAPI setup
    app.config["PROPAGATE_EXCEPTIONS"] = True
    app.config["API_TITLE"] = "BiasXplorer API"
    app.config["API_VERSION"] = "v1"
    app.config["OPENAPI_VERSION"] = "3.0.3"
    app.config["OPENAPI_URL_PREFIX"] = "/"
    app.config["OPENAPI_SWAGGER_UI_PATH"] = "/swagger-ui"
    app.config["OPENAPI_SWAGGER_UI_URL"] = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"

    # CORS setup (frontend on localhost:5173)
    CORS(
        app,
        resources={r"/*": {"origins": ["http://localhost:5173"]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Initialize Flask-Smorest API
    api = Api(app)

    # Simple health check routes
    @app.get("/")
    def root():
        return jsonify({
            "name": "BiasXplorer API",
            "status": "ok",
            "docs": "/swagger-ui"
        }), 200

    @app.get("/health")
    def health():
        return jsonify({"status": "healthy"}), 200

    # Register all modular blueprints
    api.register_blueprint(UploadBlueprint)
    api.register_blueprint(PreprocessBlueprint)
    api.register_blueprint(BiasBlueprint)
    api.register_blueprint(SelectBlueprint)
    api.register_blueprint(ReportBlueprint)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
